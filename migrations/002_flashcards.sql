-- Mazo de flashcards. El estado de repaso vive aparte del de los examenes
-- a proposito: reconocer una palabra en una tarjeta es mas facil que producirla
-- en un fill-in-the-blank. Si los repasos alimentaran candidate_stats, una
-- palabra dejaria de salir en los examenes sin que sepas realmente escribirla.

CREATE TABLE IF NOT EXISTS flashcards (
    id                SERIAL PRIMARY KEY,
    candidate_id      INTEGER NOT NULL UNIQUE REFERENCES blank_candidates(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Origen: 'auto' si nacio de un fallo en examen, 'manual' si la agregaste tu.
    origin            VARCHAR(10) NOT NULL DEFAULT 'auto',
    -- Estado SM-2 simplificado
    ease              REAL    NOT NULL DEFAULT 2.5,   -- factor de facilidad, min 1.3
    interval_days     REAL    NOT NULL DEFAULT 0,
    due_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reps              INTEGER NOT NULL DEFAULT 0,     -- repasos acertados seguidos
    lapses            INTEGER NOT NULL DEFAULT 0,     -- veces que se cayo
    suspended         BOOLEAN NOT NULL DEFAULT FALSE,
    last_reviewed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards(due_at) WHERE NOT suspended;

CREATE TABLE IF NOT EXISTS flashcard_reviews (
    id               SERIAL PRIMARY KEY,
    flashcard_id     INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    grade            SMALLINT NOT NULL,   -- 0 otra vez | 1 dificil | 2 bien
    typed_answer     TEXT,                -- lo que escribiste, si escribiste algo
    interval_before  REAL,
    interval_after   REAL,
    reviewed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_card ON flashcard_reviews(flashcard_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON flashcard_reviews(reviewed_at DESC);
