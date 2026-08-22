-- Esquema base: scripts -> lineas -> candidatos a hueco, y el historial de intentos.

CREATE TABLE IF NOT EXISTS scripts (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    topic       VARCHAR(120),
    level       VARCHAR(4),               -- A1 A2 B1 B2 C1 C2
    source      VARCHAR(255),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS script_lines (
    id          SERIAL PRIMARY KEY,
    script_id   INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    ord         INTEGER NOT NULL,
    speaker     VARCHAR(80),              -- NULL = narracion / texto corrido
    text        TEXT NOT NULL,
    UNIQUE (script_id, ord)
);

CREATE INDEX IF NOT EXISTS idx_script_lines_script ON script_lines(script_id, ord);

-- Un candidato es un tramo concreto del texto de una linea: [start_pos, end_pos).
-- Se guardan offsets y no la palabra suelta porque "the" aparece 40 veces.
CREATE TABLE IF NOT EXISTS blank_candidates (
    id           SERIAL PRIMARY KEY,
    line_id      INTEGER NOT NULL REFERENCES script_lines(id) ON DELETE CASCADE,
    script_id    INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    start_pos    INTEGER NOT NULL,
    end_pos      INTEGER NOT NULL,
    answer       TEXT NOT NULL,
    alt_answers  TEXT[] NOT NULL DEFAULT '{}',
    distractors  TEXT[] NOT NULL DEFAULT '{}',
    difficulty   SMALLINT NOT NULL DEFAULT 3,   -- 1 facil .. 5 dificil
    tag          VARCHAR(40) NOT NULL DEFAULT 'vocab',
    reason       TEXT,
    enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (line_id, start_pos, end_pos)
);

CREATE INDEX IF NOT EXISTS idx_candidates_script ON blank_candidates(script_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_candidates_line ON blank_candidates(line_id);

CREATE TABLE IF NOT EXISTS attempts (
    id           SERIAL PRIMARY KEY,
    mode         VARCHAR(20) NOT NULL,     -- script | general | speaker
    script_id    INTEGER REFERENCES scripts(id) ON DELETE SET NULL,
    config       JSONB NOT NULL DEFAULT '{}',
    total        INTEGER NOT NULL DEFAULT 0,
    correct      INTEGER NOT NULL DEFAULT 0,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_attempts_finished ON attempts(finished_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS attempt_blanks (
    id            SERIAL PRIMARY KEY,
    attempt_id    INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    candidate_id  INTEGER NOT NULL REFERENCES blank_candidates(id) ON DELETE CASCADE,
    user_answer   TEXT,
    verdict       VARCHAR(10) NOT NULL,    -- correct | typo | wrong | skipped
    ms_taken      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_attempt_blanks_attempt ON attempt_blanks(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_blanks_candidate ON attempt_blanks(candidate_id);

-- Agregado para la repeticion espaciada: se actualiza al cerrar cada intento.
-- Es tabla y no vista porque el muestreo pondera por estas columnas en cada quiz.
CREATE TABLE IF NOT EXISTS candidate_stats (
    candidate_id  INTEGER PRIMARY KEY REFERENCES blank_candidates(id) ON DELETE CASCADE,
    seen          INTEGER NOT NULL DEFAULT 0,
    wrong         INTEGER NOT NULL DEFAULT 0,
    streak        INTEGER NOT NULL DEFAULT 0,   -- aciertos seguidos
    last_seen     TIMESTAMPTZ
);
