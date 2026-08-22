import 'server-only';
import type { PoolClient } from 'pg';
import { query, tx } from './db';
import type { CandidateTag } from './types';
import { schedule, type Grade } from './srs';

export type { Grade };

export interface Flashcard {
  id: number;
  candidateId: number;
  /** La frase partida en el hueco: `before` + respuesta + `after`.
   *  Partida y no con un marcador dentro, para poder renderizar el frente
   *  (con el vacio) y el reverso (con la palabra resaltada) desde lo mismo. */
  before: string;
  after: string;
  answer: string;
  altAnswers: string[];
  tag: CandidateTag;
  reason: string | null;
  speaker: string | null;
  /** Turno anterior del dialogo: sin el, media tarjeta no tiene contexto. */
  context: string | null;
  contextSpeaker: string | null;
  scriptTitle: string;
  scriptId: number;
  reps: number;
  lapses: number;
  intervalDays: number;
  /** Factor SM-2 actual: el cliente lo necesita para previsualizar los intervalos. */
  ease: number;
  isNew: boolean;
}

export interface DeckStats {
  total: number;
  due: number;
  fresh: number;      // nunca repasadas
  learning: number;   // intervalo < 7 dias
  mature: number;     // intervalo >= 7 dias
  suspended: number;
  reviewedToday: number;
}


interface CardRow {
  id: number;
  candidate_id: number;
  answer: string;
  alt_answers: string[];
  tag: CandidateTag;
  reason: string | null;
  start_pos: number;
  end_pos: number;
  line_text: string;
  speaker: string | null;
  context: string | null;
  context_speaker: string | null;
  script_title: string;
  script_id: number;
  reps: number;
  lapses: number;
  interval_days: number;
  ease: number;
}

const CARD_SELECT = `
  SELECT f.id, f.candidate_id, f.reps, f.lapses, f.interval_days, f.ease,
         c.answer, c.alt_answers, c.tag, c.reason, c.start_pos, c.end_pos,
         l.text AS line_text, l.speaker,
         prev.text AS context, prev.speaker AS context_speaker,
         s.title AS script_title, s.id AS script_id
    FROM flashcards f
    JOIN blank_candidates c ON c.id = f.candidate_id
    JOIN script_lines l     ON l.id = c.line_id
    JOIN scripts s          ON s.id = c.script_id
    LEFT JOIN script_lines prev ON prev.script_id = l.script_id AND prev.ord = l.ord - 1
`;

function toCard(r: CardRow): Flashcard {
  return {
    id: r.id,
    candidateId: r.candidate_id,
    before: r.line_text.slice(0, r.start_pos),
    after: r.line_text.slice(r.end_pos),
    answer: r.answer,
    altAnswers: r.alt_answers,
    tag: r.tag,
    reason: r.reason,
    speaker: r.speaker,
    context: r.context,
    contextSpeaker: r.context_speaker,
    scriptTitle: r.script_title,
    scriptId: r.script_id,
    reps: r.reps,
    lapses: r.lapses,
    intervalDays: r.interval_days,
    ease: r.ease,
    isNew: r.reps === 0,
  };
}

/** Tarjetas que tocan hoy. Las nuevas van al final para no ahogar el repaso. */
export async function dueCards(userId: number, limit = 30): Promise<Flashcard[]> {
  const rows = await query<CardRow>(
    `${CARD_SELECT}
      WHERE f.user_id = $1 AND NOT f.suspended AND f.due_at <= NOW()
      ORDER BY (f.reps = 0), f.due_at
      LIMIT $2`,
    [userId, limit],
  );
  return rows.map(toCard);
}

export async function allCards(userId: number): Promise<Array<Flashcard & { due: string; suspended: boolean }>> {
  const rows = await query<CardRow & { due_at: string; suspended: boolean }>(
    `${CARD_SELECT} WHERE f.user_id = $1 ORDER BY f.suspended, f.due_at`,
    [userId],
  );
  return rows.map((r) => ({ ...toCard(r), due: r.due_at, suspended: r.suspended }));
}

export async function deckStats(userId: number): Promise<DeckStats> {
  const [s] = await query<Record<string, string>>(`
    SELECT COUNT(*)                                                          AS total,
           COUNT(*) FILTER (WHERE NOT suspended AND due_at <= NOW())         AS due,
           COUNT(*) FILTER (WHERE NOT suspended AND reps = 0)                AS fresh,
           COUNT(*) FILTER (WHERE NOT suspended AND reps > 0 AND interval_days < 7)  AS learning,
           COUNT(*) FILTER (WHERE NOT suspended AND interval_days >= 7)      AS mature,
           COUNT(*) FILTER (WHERE suspended)                                 AS suspended
      FROM flashcards WHERE user_id = $1
  `, [userId]);
  const [r] = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM flashcard_reviews r
       JOIN flashcards f ON f.id = r.flashcard_id
      WHERE f.user_id = $1 AND r.reviewed_at >= date_trunc('day', NOW())`,
    [userId],
  );
  return {
    total: Number(s.total), due: Number(s.due), fresh: Number(s.fresh),
    learning: Number(s.learning), mature: Number(s.mature),
    suspended: Number(s.suspended), reviewedToday: Number(r.n),
  };
}

/**
 * Crea o reactiva la tarjeta de un hueco fallado en examen.
 * Si ya existia, cuenta como caida: se reinicia el intervalo y baja la facilidad.
 * Fallar en un examen pesa mas que fallar en una tarjeta, por eso resetea entero.
 */
export async function registerFailure(
  client: PoolClient,
  candidateId: number,
  userId: number,
): Promise<boolean> {
  // xmax = 0 distingue un INSERT real de un UPDATE por conflicto: sirve para
  // decirle al usuario cuantas palabras son nuevas en el mazo y cuantas recayeron.
  const { rows } = await client.query<{ inserted: boolean }>(
    `INSERT INTO flashcards (candidate_id, user_id, origin) VALUES ($1, $2, 'auto')
     ON CONFLICT (user_id, candidate_id) DO UPDATE SET
       ease          = GREATEST(1.3, flashcards.ease - 0.2),
       interval_days = 0,
       due_at        = NOW(),
       reps          = 0,
       lapses        = flashcards.lapses + 1,
       suspended     = FALSE
     RETURNING (xmax = 0) AS inserted`,
    [candidateId, userId],
  );
  return rows[0]?.inserted ?? false;
}

/** Alta manual desde la pantalla de resultados o desde un script. */
export async function addCard(candidateId: number, userId: number): Promise<void> {
  await query(
    `INSERT INTO flashcards (candidate_id, user_id, origin) VALUES ($1, $2, 'manual')
     ON CONFLICT (user_id, candidate_id) DO UPDATE SET suspended = FALSE`,
    [candidateId, userId],
  );
}

// El user_id va en el WHERE de todas las mutaciones: nadie toca el mazo de otro
// aunque adivine un id.
export async function removeCard(flashcardId: number, userId: number): Promise<void> {
  await query('DELETE FROM flashcards WHERE id = $1 AND user_id = $2', [flashcardId, userId]);
}

export async function setSuspended(flashcardId: number, suspended: boolean, userId: number): Promise<void> {
  await query('UPDATE flashcards SET suspended = $2 WHERE id = $1 AND user_id = $3',
    [flashcardId, suspended, userId]);
}

export interface ReviewOutcome {
  /** Dias hasta el proximo repaso; 0 = vuelve en esta misma sesion. */
  intervalDays: number;
}

export async function reviewCard(
  flashcardId: number,
  grade: Grade,
  typedAnswer: string | null,
  userId: number,
): Promise<ReviewOutcome> {
  return tx(async (c) => {
    const { rows } = await c.query<{ ease: number; interval_days: number; reps: number }>(
      'SELECT ease, interval_days, reps FROM flashcards WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [flashcardId, userId],
    );
    if (!rows.length) throw new Error('Tarjeta no encontrada.');

    const before = rows[0];
    const next = schedule(grade, {
      ease: before.ease, interval: before.interval_days, reps: before.reps,
    });

    await c.query(
      // $3 aparece dos veces y Postgres exige deducirle UN solo tipo (42P08):
      // sin el cast explicito en ambos lados infiere `real` por la columna y
      // `double precision` por la multiplicacion del intervalo, y falla.
      `UPDATE flashcards SET
         ease = $2, interval_days = $3::float8, reps = $4,
         lapses = lapses + $5,
         due_at = NOW() + ($3::float8 * INTERVAL '1 day'),
         last_reviewed_at = NOW()
       WHERE id = $1`,
      [flashcardId, next.ease, next.interval, next.reps, next.lapse ? 1 : 0],
    );
    await c.query(
      `INSERT INTO flashcard_reviews (flashcard_id, grade, typed_answer, interval_before, interval_after)
       VALUES ($1,$2,$3,$4,$5)`,
      [flashcardId, grade, typedAnswer || null, before.interval_days, next.interval],
    );

    return { intervalDays: next.interval };
  });
}
