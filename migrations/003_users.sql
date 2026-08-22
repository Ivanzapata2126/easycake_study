-- Multiusuario. Cada quien con sus scripts, intentos, estadisticas y flashcards.
-- El admin puede ademas publicar scripts para que los vea todo el mundo.

CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    username       VARCHAR(60)  NOT NULL UNIQUE,
    name           VARCHAR(120),
    password_hash  TEXT         NOT NULL,
    role           VARCHAR(10)  NOT NULL DEFAULT 'user',   -- admin | user
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_chk CHECK (role IN ('admin', 'user'))
);

-- Sesiones en base y no JWT: permite cerrar la sesion de alguien de verdad
-- (borrar la fila) en vez de esperar a que expire un token que ya no controlas.
CREATE TABLE IF NOT EXISTS sessions (
    token       CHAR(64) PRIMARY KEY,          -- 32 bytes aleatorios en hex
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);

-- Admin inicial. Password: easycake2026 (cambiala desde /admin).
INSERT INTO users (username, name, password_hash, role)
VALUES ('admin', 'Administrador',
        '$2b$10$zc4WujwPWCwHyCqpSKBhJeDDJ4gg5lQdO6uc/0vTBhgVtyAO1jfIW', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ---------------------------------------------------------------- scripts

ALTER TABLE scripts ADD COLUMN IF NOT EXISTS user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Lo que ya existia pasa a ser del admin y queda publico: era material de ejemplo.
UPDATE scripts
   SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
       is_public = TRUE
 WHERE user_id IS NULL;

ALTER TABLE scripts ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scripts_owner  ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_public ON scripts(is_public) WHERE is_public;

-- ---------------------------------------------------------------- intentos

ALTER TABLE attempts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
UPDATE attempts SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
 WHERE user_id IS NULL;
ALTER TABLE attempts ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, finished_at DESC);

-- ------------------------------------------------- estadisticas por usuario
-- La PK deja de ser el candidato: dos personas trabajando el mismo script
-- publico tienen progreso independiente sobre el mismo hueco.

ALTER TABLE candidate_stats ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
UPDATE candidate_stats SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
 WHERE user_id IS NULL;
ALTER TABLE candidate_stats ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE candidate_stats DROP CONSTRAINT IF EXISTS candidate_stats_pkey;
ALTER TABLE candidate_stats ADD  CONSTRAINT candidate_stats_pkey PRIMARY KEY (user_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_stats_candidate ON candidate_stats(candidate_id);

-- ------------------------------------------------------ flashcards por usuario

ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
UPDATE flashcards SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
 WHERE user_id IS NULL;
ALTER TABLE flashcards ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_candidate_id_key;
ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_user_candidate_key;
ALTER TABLE flashcards ADD  CONSTRAINT flashcards_user_candidate_key UNIQUE (user_id, candidate_id);

DROP INDEX IF EXISTS idx_flashcards_due;
CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards(user_id, due_at) WHERE NOT suspended;
