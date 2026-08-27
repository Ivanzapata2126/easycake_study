import 'server-only';
import { query, tx } from './db';
import { shuffle } from './analyzer';
import { grade, isSuccess, buildHint, diffSentence } from './grading';
import { registerFailure } from './flashcards';
import { canView } from './scripts';
import type { User } from './users';
import type {
  AttemptResult, BlankResult, CandidateRow, LineRow,
  Quiz, QuizConfig, QuizLine, QuizPassage, QuizSegment, QuizSentence, SentenceResultRow,
} from './types';

interface CandidateWithStats extends CandidateRow {
  seen: number;
  wrong: number;
  streak: number;
  last_seen: string | null;
  ord: number;
  line_speaker: string | null;
}

/**
 * Peso de un candidato en el muestreo. Esto es la repeticion espaciada:
 * lo que fallas vuelve a salir, lo que ya dominas se aparta.
 */
function weightOf(c: CandidateWithStats): number {
  let w = 0.6 + 0.15 * c.difficulty;      // 1 -> 0.75 ... 5 -> 1.35

  if (c.seen === 0) {
    w *= 1.4;                              // material nuevo primero
  } else {
    const errorRate = c.wrong / c.seen;
    w *= 1 + 2 * errorRate;                // hasta 3x si siempre lo fallas
    w *= Math.max(0.1, Math.pow(0.75, c.streak));  // decae con aciertos seguidos
    if (c.last_seen) {
      const hours = (Date.now() - new Date(c.last_seen).getTime()) / 3_600_000;
      if (hours < 24) w *= 0.5;            // no repetir lo de hace un rato
    }
  }
  return Math.max(w, 0.01);
}

/** Muestreo ponderado sin reemplazo. */
function weightedSample<T>(items: T[], weights: number[], n: number): T[] {
  const pool = items.map((item, i) => ({ item, w: weights[i] }));
  const out: T[] = [];

  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) { idx = i; break; }
    }
    out.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return out;
}

function countWords(text: string): number {
  return (text.match(/[A-Za-z]+/g) ?? []).length;
}

async function candidatesFor(
  userId: number,
  scriptIds: number[],
  lineIds?: number[],
): Promise<CandidateWithStats[]> {
  const where = lineIds
    ? 'c.line_id = ANY($2::int[])'
    : 'c.script_id = ANY($2::int[])';
  // El join de estadisticas va por (usuario, candidato): dos personas sobre el
  // mismo script publico tienen progreso independiente.
  return query<CandidateWithStats>(
    `SELECT c.*, l.ord, l.speaker AS line_speaker,
            COALESCE(s.seen,0)   AS seen,
            COALESCE(s.wrong,0)  AS wrong,
            COALESCE(s.streak,0) AS streak,
            s.last_seen
       FROM blank_candidates c
       JOIN script_lines l ON l.id = c.line_id
       LEFT JOIN candidate_stats s ON s.candidate_id = c.id AND s.user_id = $1
      WHERE c.enabled AND ${where}`,
    [userId, lineIds ?? scriptIds],
  );
}

export async function buildQuiz(config: QuizConfig, user: User): Promise<Quiz> {
  if (config.format === 'sentence') return buildSentenceQuiz(config, user);

  const passagesRaw: Array<{ scriptId: number; title: string; lines: LineRow[] }> = [];

  if (config.mode === 'general') {
    const wanted = config.passages ?? 4;
    const scripts = await query<{ id: number; title: string }>(
      `SELECT DISTINCT s.id, s.title
         FROM scripts s JOIN blank_candidates c ON c.script_id = s.id AND c.enabled
        WHERE s.user_id = $1 OR s.is_public`,
      [user.id],
    );
    if (!scripts.length) throw new Error('No hay scripts analizados todavia.');

    // Pasajes, no frases sueltas: 4-8 turnos consecutivos conservan el contexto
    // sin el cual un fill-in-the-blank deja de tener respuesta deducible.
    for (const s of shuffle(scripts).slice(0, wanted)) {
      const lines = await query<LineRow>(
        'SELECT * FROM script_lines WHERE script_id = $1 ORDER BY ord',
        [s.id],
      );
      if (!lines.length) continue;
      const size = Math.min(lines.length, 4 + Math.floor(Math.random() * 5));
      const start = Math.floor(Math.random() * (lines.length - size + 1));
      passagesRaw.push({ scriptId: s.id, title: s.title, lines: lines.slice(start, start + size) });
    }
  } else {
    if (!config.scriptId) throw new Error('Falta el script.');
    const [script] = await query<{ id: number; title: string; user_id: number; is_public: boolean }>(
      'SELECT id, title, user_id, is_public FROM scripts WHERE id = $1', [config.scriptId],
    );
    if (!script || !canView(script, user)) throw new Error('Script no encontrado.');
    const lines = await query<LineRow>(
      'SELECT * FROM script_lines WHERE script_id = $1 ORDER BY ord',
      [config.scriptId],
    );
    passagesRaw.push({ scriptId: script.id, title: script.title, lines });
  }

  const allLines = passagesRaw.flatMap((p) => p.lines);
  if (!allLines.length) throw new Error('El script no tiene lineas.');

  // En modo "speaker" solo se tapan las lineas de ese hablante: el resto del
  // dialogo queda visible para que puedas deducir tu propio turno.
  const targetLines = config.mode === 'speaker'
    ? allLines.filter((l) => l.speaker === config.speaker)
    : allLines;
  if (!targetLines.length) throw new Error('Ese hablante no tiene lineas.');

  const cands = await candidatesFor(
    user.id,
    passagesRaw.map((p) => p.scriptId),
    targetLines.map((l) => l.id),
  );
  if (!cands.length) throw new Error('No hay huecos disponibles para esa seleccion.');

  const words = targetLines.reduce((s, l) => s + countWords(l.text), 0);
  const target = Math.max(3, Math.min(config.maxBlanks, Math.round(words * config.density)));

  const chosen = weightedSample(cands, cands.map(weightOf), target);
  const byLine = new Map<number, CandidateWithStats[]>();
  for (const c of chosen) {
    const list = byLine.get(c.line_id) ?? [];
    list.push(c);
    byLine.set(c.line_id, list);
  }

  // ---- armado de los segmentos ----
  const blanks: Quiz['blanks'] = [];
  const passages: QuizPassage[] = passagesRaw.map((p) => ({
    scriptId: p.scriptId,
    scriptTitle: p.title,
    lines: p.lines.map((line): QuizLine => {
      const onLine = (byLine.get(line.id) ?? []).sort((a, b) => a.start_pos - b.start_pos);
      const segments: QuizSegment[] = [];
      let cursor = 0;

      for (const c of onLine) {
        if (c.start_pos > cursor) {
          segments.push({ type: 'text', value: line.text.slice(cursor, c.start_pos) });
        }
        const blankIndex = blanks.length;
        blanks.push({
          candidateId: c.id,
          tag: c.tag,
          difficulty: c.difficulty,
          // En dificil no se filtra nada: ni longitud ni inicial.
          hint: config.level === 'medium' ? buildHint(c.answer) : null,
          length: config.level === 'hard' ? null : c.answer.length,
        });
        segments.push({ type: 'blank', value: '', blankIndex });
        cursor = c.end_pos;
      }
      if (cursor < line.text.length) {
        segments.push({ type: 'text', value: line.text.slice(cursor) });
      }
      return { lineId: line.id, speaker: line.speaker, segments };
    }),
  }));

  // Banco de palabras del modo facil: las respuestas mezcladas con distractores.
  let wordBank: string[] | null = null;
  if (config.level === 'easy') {
    const bank = new Set(chosen.map((c) => c.answer.toLowerCase()));
    const extras = shuffle(chosen.flatMap((c) => c.distractors))
      .filter((d) => !bank.has(d.toLowerCase()));
    for (const e of extras.slice(0, Math.ceil(chosen.length * 0.5))) bank.add(e.toLowerCase());
    wordBank = shuffle([...bank]);
  }

  const [attempt] = await query<{ id: number }>(
    `INSERT INTO attempts (mode, script_id, config, total, user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      config.mode,
      config.mode === 'general' ? null : config.scriptId,
      JSON.stringify({ ...config, candidateIds: chosen.map((c) => c.id) }),
      chosen.length,
      user.id,
    ],
  );

  return {
    attemptId: attempt.id,
    mode: config.mode,
    format: 'gaps',
    level: config.level,
    passages,
    blanks,
    sentences: null,
    wordBank,
  };
}

/**
 * Modo "frase completa": se muestra el espanol y hay que escribir la frase
 * entera en ingles. Solo entran lineas CON traduccion — sin ella no hay pista
 * y el ejercicio no tiene enunciado.
 */
async function buildSentenceQuiz(config: QuizConfig, user: User): Promise<Quiz> {
  const rows = config.mode === 'general'
    ? await query<LineRow & { title: string }>(
      `SELECT l.*, s.title FROM script_lines l JOIN scripts s ON s.id = l.script_id
        WHERE l.translation IS NOT NULL AND (s.user_id = $1 OR s.is_public)
        ORDER BY random() LIMIT $2`,
      [user.id, config.maxBlanks],
    )
    : await query<LineRow & { title: string }>(
      `SELECT l.*, s.title FROM script_lines l JOIN scripts s ON s.id = l.script_id
        WHERE l.script_id = $1 AND l.translation IS NOT NULL
          AND (s.user_id = $2 OR s.is_public OR $3)
        ORDER BY l.ord`,
      [config.scriptId, user.id, user.role === 'admin'],
    );

  if (!rows.length) {
    throw new Error('Ese script todavia no tiene traducciones. Agregalas editandolo: "ingles | espanol".');
  }

  const sentences: QuizSentence[] = rows.map((l) => ({
    lineId: l.id,
    translation: l.translation as string,
    speaker: l.speaker,
    words: countWords(l.text),
  }));

  const [attempt] = await query<{ id: number }>(
    `INSERT INTO attempts (mode, script_id, config, total, user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      config.mode,
      config.mode === 'general' ? null : config.scriptId,
      JSON.stringify({ ...config, lineIds: rows.map((l) => l.id) }),
      rows.length,
      user.id,
    ],
  );

  return {
    attemptId: attempt.id,
    mode: config.mode,
    format: 'sentence',
    level: config.level,
    passages: [],
    blanks: [],
    sentences,
    wordBank: null,
  };
}

/**
 * Corrige el intento en el servidor. Las respuestas nunca viajan al cliente al
 * construir el quiz, por eso la correccion vive aqui y no en el navegador.
 */
export async function gradeAttempt(
  attemptId: number,
  answers: Record<string, string>,
  userId: number,
): Promise<AttemptResult> {
  // El user_id en el WHERE evita que alguien corrija el intento de otro
  // mandando un attemptId cualquiera.
  const [attempt] = await query<{
    id: number;
    config: { candidateIds?: number[]; lineIds?: number[]; format?: string };
  }>(
    'SELECT id, config FROM attempts WHERE id = $1 AND user_id = $2 AND finished_at IS NULL',
    [attemptId, userId],
  );
  if (!attempt) throw new Error('Intento no encontrado o ya cerrado.');

  if (attempt.config.format === 'sentence') {
    return gradeSentenceAttempt(attemptId, attempt.config.lineIds ?? [], answers);
  }

  const ids = attempt.config.candidateIds ?? [];
  const cands = await query<CandidateRow>(
    'SELECT * FROM blank_candidates WHERE id = ANY($1::int[])',
    [ids],
  );
  const byId = new Map(cands.map((c) => [c.id, c]));

  const results: BlankResult[] = [];
  for (const id of ids) {
    const c = byId.get(id);
    if (!c) continue;
    const raw = answers[String(id)] ?? '';
    const { verdict, expected } = grade(raw, c.answer, c.alt_answers);
    results.push({
      candidateId: id, verdict, userAnswer: raw, expected,
      tag: c.tag, reason: c.reason,
    });
  }

  const correct = results.filter((r) => isSuccess(r.verdict)).length;
  let cardsAdded = 0;
  let cardsRelapsed = 0;

  await tx(async (client) => {
    for (const r of results) {
      // Lo que fallaste o dejaste en blanco se va solo al mazo de flashcards.
      // Un typo no: sabias la palabra, solo la escribiste mal.
      if (r.verdict === 'wrong' || r.verdict === 'skipped') {
        const isNew = await registerFailure(client, r.candidateId, userId);
        if (isNew) cardsAdded++;
        else cardsRelapsed++;
      }
      await client.query(
        'INSERT INTO attempt_blanks (attempt_id, candidate_id, user_answer, verdict) VALUES ($1,$2,$3,$4)',
        [attemptId, r.candidateId, r.userAnswer, r.verdict],
      );
      const ok = isSuccess(r.verdict);
      await client.query(
        `INSERT INTO candidate_stats (candidate_id, user_id, seen, wrong, streak, last_seen)
         VALUES ($1, $4, 1, $2, $3, NOW())
         ON CONFLICT (user_id, candidate_id) DO UPDATE SET
           seen      = candidate_stats.seen + 1,
           wrong     = candidate_stats.wrong + $2,
           streak    = CASE WHEN $3 = 0 THEN 0 ELSE candidate_stats.streak + 1 END,
           last_seen = NOW()`,
        [r.candidateId, ok ? 0 : 1, ok ? 1 : 0, userId],
      );
    }
    await client.query(
      'UPDATE attempts SET correct = $2, total = $3, finished_at = NOW() WHERE id = $1',
      [attemptId, correct, results.length],
    );
  });

  return {
    attemptId, format: 'gaps', total: results.length, correct, results,
    sentences: [], cardsAdded, cardsRelapsed,
  };
}

/**
 * Correccion del modo "frase completa".
 *
 * No alimenta candidate_stats ni el mazo de flashcards: aquellos van por hueco
 * y aqui la unidad es la frase entera. Se guarda la puntuacion del intento, que
 * es lo que alimenta el historial.
 */
async function gradeSentenceAttempt(
  attemptId: number,
  lineIds: number[],
  answers: Record<string, string>,
): Promise<AttemptResult> {
  const rows = await query<LineRow>(
    'SELECT * FROM script_lines WHERE id = ANY($1::int[])',
    [lineIds],
  );
  const byId = new Map(rows.map((l) => [l.id, l]));

  const sentences: SentenceResultRow[] = [];
  for (const id of lineIds) {
    const line = byId.get(id);
    if (!line) continue;
    const raw = answers[String(id)] ?? '';
    const r = diffSentence(raw, line.text);
    sentences.push({
      lineId: id,
      translation: line.translation ?? '',
      expected: line.text,
      userAnswer: raw,
      verdict: r.verdict,
      diff: r.diff,
      matched: r.matched,
      words: r.total,
    });
  }

  const correct = sentences.filter((s) => isSuccess(s.verdict)).length;
  await query(
    'UPDATE attempts SET correct = $2, total = $3, finished_at = NOW() WHERE id = $1',
    [attemptId, correct, sentences.length],
  );

  return {
    attemptId, format: 'sentence', total: sentences.length, correct,
    results: [], sentences, cardsAdded: 0, cardsRelapsed: 0,
  };
}

// ------------------------------------------------------------- estadisticas

export interface DashboardStats {
  scripts: number;
  candidates: number;
  attempts: number;
  accuracy: number | null;
  weakest: Array<{ answer: string; tag: string; wrong: number; seen: number; title: string }>;
  byTag: Array<{ tag: string; seen: number; wrong: number }>;
}

export async function dashboardStats(userId: number): Promise<DashboardStats> {
  // "Scripts" y "huecos" cuentan lo que este usuario puede practicar: lo suyo
  // mas lo publicado por el admin.
  const [counts] = await query<{ scripts: string; candidates: string; attempts: string }>(`
    SELECT (SELECT COUNT(*) FROM scripts s
             WHERE s.user_id = $1 OR s.is_public)                            AS scripts,
           (SELECT COUNT(*) FROM blank_candidates c
              JOIN scripts s ON s.id = c.script_id
             WHERE c.enabled AND (s.user_id = $1 OR s.is_public))            AS candidates,
           (SELECT COUNT(*) FROM attempts
             WHERE user_id = $1 AND finished_at IS NOT NULL)                 AS attempts
  `, [userId]);

  const [acc] = await query<{ total: string | null; correct: string | null }>(
    `SELECT SUM(total) AS total, SUM(correct) AS correct
       FROM attempts WHERE user_id = $1 AND finished_at IS NOT NULL`,
    [userId],
  );

  const weakest = await query<{ answer: string; tag: string; wrong: number; seen: number; title: string }>(`
    SELECT c.answer, c.tag, s.wrong::int, s.seen::int, sc.title
      FROM candidate_stats s
      JOIN blank_candidates c ON c.id = s.candidate_id
      JOIN scripts sc ON sc.id = c.script_id
     WHERE s.user_id = $1 AND s.wrong > 0
     ORDER BY (s.wrong::float / NULLIF(s.seen,0)) DESC, s.wrong DESC
     LIMIT 10
  `, [userId]);

  const byTag = await query<{ tag: string; seen: number; wrong: number }>(`
    SELECT c.tag, SUM(s.seen)::int AS seen, SUM(s.wrong)::int AS wrong
      FROM candidate_stats s
      JOIN blank_candidates c ON c.id = s.candidate_id
     WHERE s.user_id = $1
     GROUP BY c.tag
     ORDER BY wrong DESC
  `, [userId]);

  const total = Number(acc?.total ?? 0);
  return {
    scripts: Number(counts.scripts),
    candidates: Number(counts.candidates),
    attempts: Number(counts.attempts),
    accuracy: total > 0 ? Number(acc.correct) / total : null,
    weakest,
    byTag,
  };
}

export async function recentAttempts(userId: number, limit = 10) {
  return query<{
    id: number; mode: string; total: number; correct: number;
    finished_at: string; title: string | null;
  }>(
    `SELECT a.id, a.mode, a.total, a.correct, a.finished_at, s.title
       FROM attempts a LEFT JOIN scripts s ON s.id = a.script_id
      WHERE a.user_id = $1 AND a.finished_at IS NOT NULL
      ORDER BY a.finished_at DESC LIMIT $2`,
    [userId, limit],
  );
}
