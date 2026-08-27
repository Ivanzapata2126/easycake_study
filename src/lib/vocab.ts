import 'server-only';
import { query, tx } from './db';
import { schedule, type Grade } from './srs';

// Vocabulario por script. El mazo NO se guarda: se deriva cruzando los
// candidatos del script con el glosario global. Asi un script nuevo hereda solo
// las palabras que el glosario ya conozca, sin migraciones ni ids que casar.

export interface VocabCard {
  word: string;
  translation: string;
  tag: string;
  note: string | null;
  reps: number;
  lapses: number;
  intervalDays: number;
  ease: number;
  suspended: boolean;
  isNew: boolean;
  due: boolean;
}

export interface ScriptDeck {
  scriptId: number;
  title: string;
  level: string | null;
  topic: string | null;
  isPublic: boolean;
  words: number;
  due: number;
  learned: number;
}

/** Un usuario solo ve mazos de scripts suyos o publicos. */
const VISIBLE = '(s.user_id = $1 OR s.is_public)';

export async function scriptDecks(userId: number): Promise<ScriptDeck[]> {
  return query<ScriptDeck>(`
    SELECT s.id                     AS "scriptId",
           s.title, s.level, s.topic,
           s.is_public              AS "isPublic",
           COUNT(DISTINCT g.word)::int AS words,
           COUNT(DISTINCT g.word) FILTER (
             WHERE p.word IS NULL OR (NOT p.suspended AND p.due_at <= NOW())
           )::int                   AS due,
           COUNT(DISTINCT g.word) FILTER (WHERE p.reps > 0)::int AS learned
      FROM scripts s
      JOIN blank_candidates c ON c.script_id = s.id AND c.enabled
      JOIN glossary g         ON g.word = lower(c.answer)
      LEFT JOIN vocab_progress p ON p.word = g.word AND p.user_id = $1
     WHERE ${VISIBLE}
     GROUP BY s.id, s.title, s.level, s.topic, s.is_public
     HAVING COUNT(DISTINCT g.word) > 0
     ORDER BY s.title
  `, [userId]);
}

export async function deckCards(userId: number, scriptId: number): Promise<VocabCard[]> {
  return query<VocabCard>(`
    SELECT g.word, g.translation, g.tag, g.note,
           COALESCE(p.reps, 0)::int          AS reps,
           COALESCE(p.lapses, 0)::int        AS lapses,
           COALESCE(p.interval_days, 0)::real AS "intervalDays",
           COALESCE(p.ease, 2.5)::real       AS ease,
           COALESCE(p.suspended, FALSE)      AS suspended,
           (p.word IS NULL)                  AS "isNew",
           (p.word IS NULL OR (NOT p.suspended AND p.due_at <= NOW())) AS due
      FROM scripts s
      JOIN blank_candidates c ON c.script_id = s.id AND c.enabled
      JOIN glossary g         ON g.word = lower(c.answer)
      LEFT JOIN vocab_progress p ON p.word = g.word AND p.user_id = $2
     WHERE s.id = $1 AND ${VISIBLE.replace('$1', '$2')}
     GROUP BY g.word, g.translation, g.tag, g.note,
              p.reps, p.lapses, p.interval_days, p.ease, p.suspended, p.word, p.due_at
     ORDER BY (p.word IS NOT NULL), g.tag, g.word
  `, [scriptId, userId]);
}

export async function scriptTitle(scriptId: number, userId: number): Promise<string | null> {
  const [row] = await query<{ title: string }>(
    `SELECT s.title FROM scripts s WHERE s.id = $2 AND ${VISIBLE}`,
    [userId, scriptId],
  );
  return row?.title ?? null;
}

/**
 * Registra un repaso. La fila de progreso se crea la primera vez que respondes
 * — no al desplegar: si se sembrara una fila por usuario y palabra, cada
 * usuario nuevo necesitaria un backfill y el glosario dejaria de ser global.
 */
export async function reviewVocab(userId: number, word: string, grade: Grade): Promise<number> {
  return tx(async (c) => {
    const { rows } = await c.query<{ ease: number; interval_days: number; reps: number }>(
      'SELECT ease, interval_days, reps FROM vocab_progress WHERE user_id = $1 AND word = $2 FOR UPDATE',
      [userId, word],
    );
    const before = rows[0] ?? { ease: 2.5, interval_days: 0, reps: 0 };
    const next = schedule(grade, {
      ease: before.ease, interval: before.interval_days, reps: before.reps,
    });

    await c.query(
      `INSERT INTO vocab_progress (user_id, word, ease, interval_days, reps, lapses, due_at, last_reviewed_at)
       VALUES ($1, $2, $3, $4::float8, $5, $6, NOW() + ($4::float8 * INTERVAL '1 day'), NOW())
       ON CONFLICT (user_id, word) DO UPDATE SET
         ease = $3, interval_days = $4::float8, reps = $5,
         lapses = vocab_progress.lapses + $6,
         due_at = NOW() + ($4::float8 * INTERVAL '1 day'),
         suspended = FALSE,
         last_reviewed_at = NOW()`,
      [userId, word, next.ease, next.interval, next.reps, next.lapse ? 1 : 0],
    );
    return next.interval;
  });
}

/** "Ya me la se": la aparta sin borrarla del glosario, que es compartido. */
export async function suspendVocab(userId: number, word: string, suspended: boolean): Promise<void> {
  await query(
    `INSERT INTO vocab_progress (user_id, word, suspended) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, word) DO UPDATE SET suspended = $3`,
    [userId, word, suspended],
  );
}

export async function vocabTotals(userId: number): Promise<{ words: number; due: number; learned: number }> {
  const [row] = await query<Record<string, string>>(`
    SELECT COUNT(DISTINCT g.word) AS words,
           COUNT(DISTINCT g.word) FILTER (
             WHERE p.word IS NULL OR (NOT p.suspended AND p.due_at <= NOW())
           ) AS due,
           COUNT(DISTINCT g.word) FILTER (WHERE p.reps > 0) AS learned
      FROM scripts s
      JOIN blank_candidates c ON c.script_id = s.id AND c.enabled
      JOIN glossary g         ON g.word = lower(c.answer)
      LEFT JOIN vocab_progress p ON p.word = g.word AND p.user_id = $1
     WHERE ${VISIBLE}
  `, [userId]);
  return { words: Number(row.words), due: Number(row.due), learned: Number(row.learned) };
}
