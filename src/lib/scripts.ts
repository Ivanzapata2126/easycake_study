import 'server-only';
import type { PoolClient } from 'pg';
import { query, tx } from './db';
import { parseScript, type ParsedLine } from './parse';
import { analyzeLine, fillDistractors, type RawCandidate } from './analyzer';
import type { User } from './users';
import type { CandidateRow, LineRow, ScriptRow, ScriptSummary } from './types';

export interface ScriptInput {
  title: string;
  topic?: string | null;
  level?: string | null;
  source?: string | null;
  notes?: string | null;
  raw: string;
}

/** Puede verlo: es suyo, o es publico, o eres admin. */
export function canView(script: { user_id: number; is_public: boolean }, user: User): boolean {
  return script.user_id === user.id || script.is_public || user.role === 'admin';
}

/** Puede editarlo: solo el dueno o un admin. Publico no significa editable. */
export function canEdit(script: { user_id: number }, user: User): boolean {
  return script.user_id === user.id || user.role === 'admin';
}

export async function listScripts(user: User): Promise<ScriptSummary[]> {
  return query<ScriptSummary>(`
    SELECT s.*,
           owner.username                      AS owner_username,
           (s.user_id = $1)                    AS is_owner,
           COALESCE(l.line_count, 0)::int      AS line_count,
           COALESCE(c.candidate_count, 0)::int AS candidate_count,
           COALESCE(l.speakers, '{}')          AS speakers
      FROM scripts s
      JOIN users owner ON owner.id = s.user_id
      LEFT JOIN (
        SELECT script_id,
               COUNT(*) AS line_count,
               ARRAY_AGG(DISTINCT speaker) FILTER (WHERE speaker IS NOT NULL) AS speakers
          FROM script_lines GROUP BY script_id
      ) l ON l.script_id = s.id
      LEFT JOIN (
        SELECT script_id, COUNT(*) AS candidate_count
          FROM blank_candidates WHERE enabled GROUP BY script_id
      ) c ON c.script_id = s.id
     WHERE s.user_id = $1 OR s.is_public OR $2
     ORDER BY (s.user_id = $1) DESC, s.updated_at DESC
  `, [user.id, user.role === 'admin']);
}

/** Devuelve el script solo si el usuario puede verlo; si no, null. */
export async function getScript(id: number, user: User): Promise<ScriptRow | null> {
  const [row] = await query<ScriptRow>(
    `SELECT s.*, owner.username AS owner_username
       FROM scripts s JOIN users owner ON owner.id = s.user_id
      WHERE s.id = $1`,
    [id],
  );
  if (!row || !canView(row, user)) return null;
  return row;
}

export async function getLines(scriptId: number): Promise<LineRow[]> {
  return query<LineRow>(
    'SELECT * FROM script_lines WHERE script_id = $1 ORDER BY ord',
    [scriptId],
  );
}

export async function getCandidates(scriptId: number): Promise<CandidateRow[]> {
  return query<CandidateRow>(
    `SELECT c.* FROM blank_candidates c
       JOIN script_lines l ON l.id = c.line_id
      WHERE c.script_id = $1
      ORDER BY l.ord, c.start_pos`,
    [scriptId],
  );
}

export async function createScript(
  input: ScriptInput,
  userId: number,
  isPublic = false,
): Promise<number> {
  const parsed = parseScript(input.raw);
  if (!parsed.length) throw new Error('El texto no tiene ninguna linea utilizable.');

  return tx(async (c) => {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO scripts (title, topic, level, source, notes, user_id, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [input.title, input.topic || null, input.level || null, input.source || null,
        input.notes || null, userId, isPublic],
    );
    const scriptId = rows[0].id;

    for (let i = 0; i < parsed.length; i++) {
      const lineId = await insertLine(c, scriptId, i, parsed[i]);
      await analyzeAndStore(c, scriptId, lineId, parsed[i]);
    }
    await rebalanceDistractors(c, scriptId);
    return scriptId;
  });
}

/** Lanza si el usuario no puede tocar ese script. */
async function assertCanEdit(scriptId: number, user: User): Promise<void> {
  const [row] = await query<{ user_id: number }>('SELECT user_id FROM scripts WHERE id = $1', [scriptId]);
  if (!row) throw new Error('Script no encontrado.');
  if (!canEdit(row, user)) throw new Error('Este script no es tuyo.');
}

/**
 * Reemplaza el contenido del script conservando las lineas cuyo texto no cambio.
 * Es importante: borrar y recrear todo borraria el historial de aciertos/fallos
 * (attempt_blanks cuelga de candidate_id con ON DELETE CASCADE), y el caso normal
 * de una edicion es corregir una linea de veinte.
 */
export async function updateScript(id: number, input: ScriptInput, user: User): Promise<void> {
  await assertCanEdit(id, user);
  const parsed = parseScript(input.raw);
  if (!parsed.length) throw new Error('El texto no tiene ninguna linea utilizable.');

  await tx(async (c) => {
    await c.query(
      `UPDATE scripts SET title=$2, topic=$3, level=$4, source=$5, notes=$6, updated_at=NOW()
        WHERE id=$1`,
      [id, input.title, input.topic || null, input.level || null, input.source || null, input.notes || null],
    );

    const { rows: existing } = await c.query<LineRow>(
      'SELECT * FROM script_lines WHERE script_id = $1 ORDER BY ord',
      [id],
    );

    // Emparejamiento por texto exacto: una linea intacta conserva su id,
    // sus candidatos y sus estadisticas.
    const pool = new Map<string, LineRow[]>();
    for (const row of existing) {
      const list = pool.get(row.text) ?? [];
      list.push(row);
      pool.set(row.text, list);
    }

    const keptIds = new Set<number>();
    const reused: number[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      const match = pool.get(p.text)?.shift();

      if (match) {
        // Se mueve a su nueva posicion (ord negativo temporal por el UNIQUE).
        await c.query('UPDATE script_lines SET ord = $2, speaker = $3 WHERE id = $1', [
          match.id, -(i + 1), p.speaker,
        ]);
        keptIds.add(match.id);
        reused.push(match.id);
      } else {
        reused.push(-1);
      }
    }

    // Se borran las lineas que ya no existen ANTES de insertar las nuevas.
    const toDelete = existing.filter((r) => !keptIds.has(r.id)).map((r) => r.id);
    if (toDelete.length) {
      await c.query('DELETE FROM script_lines WHERE id = ANY($1::int[])', [toDelete]);
    }

    for (let i = 0; i < parsed.length; i++) {
      if (reused[i] > 0) {
        await c.query('UPDATE script_lines SET ord = $2 WHERE id = $1', [reused[i], i]);
      } else {
        const lineId = await insertLine(c, id, i, parsed[i]);
        await analyzeAndStore(c, id, lineId, parsed[i]);
      }
    }

    await rebalanceDistractors(c, id);
  });
}

export async function deleteScript(id: number, user: User): Promise<void> {
  await assertCanEdit(id, user);
  await query('DELETE FROM scripts WHERE id = $1', [id]);
}

/** Publicar es potestad del admin: afecta a todo el mundo. */
export async function setScriptPublic(id: number, isPublic: boolean, user: User): Promise<void> {
  if (user.role !== 'admin') throw new Error('Solo un administrador puede publicar scripts.');
  await query('UPDATE scripts SET is_public = $2, updated_at = NOW() WHERE id = $1', [id, isPublic]);
}

/**
 * Descartar un hueco cambia el script para todos los que lo usan, asi que solo
 * lo puede hacer el dueno (o un admin). Un lector de un script publico no cura
 * el material ajeno.
 */
export async function setCandidateEnabled(
  candidateId: number,
  enabled: boolean,
  user: User,
): Promise<void> {
  const [row] = await query<{ script_id: number; user_id: number }>(
    `SELECT c.script_id, s.user_id FROM blank_candidates c
       JOIN scripts s ON s.id = c.script_id WHERE c.id = $1`,
    [candidateId],
  );
  if (!row) throw new Error('Hueco no encontrado.');
  if (!canEdit(row, user)) throw new Error('Este script no es tuyo.');
  await query('UPDATE blank_candidates SET enabled = $2 WHERE id = $1', [candidateId, enabled]);
}

/** Re-analiza el script completo desde cero (util tras tocar las listas lexicas). */
export async function reanalyzeScript(id: number, user: User): Promise<number> {
  await assertCanEdit(id, user);
  return tx(async (c) => {
    const { rows: lines } = await c.query<LineRow>(
      'SELECT * FROM script_lines WHERE script_id = $1 ORDER BY ord',
      [id],
    );
    await c.query('DELETE FROM blank_candidates WHERE script_id = $1', [id]);
    for (const line of lines) {
      await analyzeAndStore(c, id, line.id, { speaker: line.speaker, text: line.text });
    }
    await rebalanceDistractors(c, id);
    const { rows } = await c.query<{ n: string }>(
      'SELECT COUNT(*) AS n FROM blank_candidates WHERE script_id = $1',
      [id],
    );
    return Number(rows[0].n);
  });
}

// ---------------------------------------------------------------- helpers

async function insertLine(c: PoolClient, scriptId: number, ord: number, p: ParsedLine): Promise<number> {
  const { rows } = await c.query<{ id: number }>(
    'INSERT INTO script_lines (script_id, ord, speaker, text) VALUES ($1,$2,$3,$4) RETURNING id',
    [scriptId, ord, p.speaker, p.text],
  );
  return rows[0].id;
}

async function analyzeAndStore(c: PoolClient, scriptId: number, lineId: number, p: ParsedLine) {
  const candidates = analyzeLine(p.text, p.speaker);
  for (const cand of candidates) {
    await c.query(
      `INSERT INTO blank_candidates
         (line_id, script_id, start_pos, end_pos, answer, alt_answers, distractors, difficulty, tag, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (line_id, start_pos, end_pos) DO NOTHING`,
      [lineId, scriptId, cand.start, cand.end, cand.answer, cand.altAnswers,
        cand.distractors, cand.difficulty, cand.tag, cand.reason],
    );
  }
}

/**
 * Los distractores se calculan a nivel de script, no de linea: los mejores son
 * palabras de la misma categoria que aparecen en otra parte del mismo dialogo.
 */
async function rebalanceDistractors(c: PoolClient, scriptId: number) {
  const { rows } = await c.query<CandidateRow>(
    'SELECT * FROM blank_candidates WHERE script_id = $1',
    [scriptId],
  );
  if (!rows.length) return;

  const raw: RawCandidate[] = rows.map((r) => ({
    start: r.start_pos, end: r.end_pos, answer: r.answer,
    altAnswers: r.alt_answers, distractors: [], difficulty: r.difficulty,
    tag: r.tag, reason: r.reason ?? '',
  }));
  fillDistractors(raw);

  for (let i = 0; i < rows.length; i++) {
    await c.query('UPDATE blank_candidates SET distractors = $2 WHERE id = $1', [
      rows[i].id, raw[i].distractors,
    ]);
  }
}
