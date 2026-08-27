-- Traduccion al espanol por linea.
--
-- Alimenta el modo de examen "frase completa": se muestra el espanol y hay que
-- escribir la frase entera en ingles. Nullable a proposito: la mayoria de los
-- scripts existentes no la tienen, y el modo solo se ofrece donde si la hay.

ALTER TABLE script_lines ADD COLUMN IF NOT EXISTS translation TEXT;

-- Para saber rapido que scripts pueden ofrecer el modo de frase completa.
CREATE INDEX IF NOT EXISTS idx_lines_translated
    ON script_lines(script_id) WHERE translation IS NOT NULL;
