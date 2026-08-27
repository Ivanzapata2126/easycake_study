-- Vocabulario por script: palabra en ingles <-> español.
--
-- El glosario NO cuelga de un script. Es global y se indexa por la palabra
-- misma, por dos razones:
--
--   1. Los ids de script no coinciden entre local y el servidor (cada base se
--      poblo por separado), asi que una migracion no puede decir "esta tarjeta
--      pertenece al script 5" sin romperse en una de las dos.
--   2. El mazo de un script se DERIVA: son las palabras de ese script que estan
--      en el glosario, cruzando por blank_candidates. Un script nuevo hereda
--      solo las palabras que ya conozca el glosario, sin tocar nada.
--
-- "squad" es una sola tarjeta aunque aparezca en tres scripts, y el progreso
-- sobre ella es uno solo: aprender una palabra no depende de donde la viste.

CREATE TABLE IF NOT EXISTS glossary (
    word         TEXT PRIMARY KEY,          -- siempre en minusculas
    translation  TEXT NOT NULL,             -- una o varias acepciones
    tag          VARCHAR(20) NOT NULL DEFAULT 'vocab',
    note         TEXT,                      -- matiz, registro o ejemplo corto
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Progreso por usuario y palabra. Mismo SM-2 que las flashcards de fallos, pero
-- en su propia tabla: son dos ejercicios distintos (producir la palabra en su
-- frase vs. reconocer su significado) y compartir intervalo los falsearia.
CREATE TABLE IF NOT EXISTS vocab_progress (
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word              TEXT    NOT NULL REFERENCES glossary(word) ON DELETE CASCADE,
    ease              REAL    NOT NULL DEFAULT 2.5,
    interval_days     REAL    NOT NULL DEFAULT 0,
    due_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reps              INTEGER NOT NULL DEFAULT 0,
    lapses            INTEGER NOT NULL DEFAULT 0,
    suspended         BOOLEAN NOT NULL DEFAULT FALSE,
    last_reviewed_at  TIMESTAMPTZ,
    PRIMARY KEY (user_id, word)
);

CREATE INDEX IF NOT EXISTS idx_vocab_due ON vocab_progress(user_id, due_at) WHERE NOT suspended;
