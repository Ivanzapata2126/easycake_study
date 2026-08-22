// Parser del texto pegado. Convierte un bloque plano en turnos (speaker + texto).
// Formatos que acepta:
//   Man: Hello there.
//   WOMAN:  I'm fine.
//   [Narrator] The door opens.
//   1. Tom: Are you coming?
//   Una linea sin ":" se guarda como narracion (speaker = null).

export interface ParsedLine {
  speaker: string | null;
  text: string;
}

// Un speaker plausible: pocas palabras, sin puntuacion de oracion.
const SPEAKER_RE = /^\s*(?:\d+\s*[.)]\s*)?[\[(]?([A-Za-z][A-Za-z0-9 .'\-_]{0,28}?)[\])]?\s*[:：]\s*(.*)$/;

export function parseScript(raw: string): ParsedLine[] {
  const lines: ParsedLine[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const m = SPEAKER_RE.exec(line);
    if (m) {
      const speaker = m[1].trim();
      const text = m[2].trim();
      // "http://..." o "Nota: esto" con speaker larguisimo no son turnos de dialogo.
      const wordCount = speaker.split(/\s+/).length;
      if (text && wordCount <= 4) {
        lines.push({ speaker: normalizeSpeaker(speaker), text });
        continue;
      }
    }

    // Sin speaker reconocible: narracion / texto corrido.
    lines.push({ speaker: null, text: stripNumbering(line) });
  }

  return lines;
}

function stripNumbering(line: string): string {
  return line.replace(/^\s*\d+\s*[.)]\s*/, '').trim();
}

/** "WOMAN" y "Woman" son el mismo hablante. Se normaliza a Capitalizado. */
function normalizeSpeaker(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Hablantes distintos del script, en orden de aparicion. */
export function speakersOf(lines: ParsedLine[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    if (l.speaker && !seen.has(l.speaker)) {
      seen.add(l.speaker);
      out.push(l.speaker);
    }
  }
  return out;
}

/** Reconstruye el texto pegable a partir de los turnos (para el modo editar). */
export function toRawText(lines: ParsedLine[]): string {
  return lines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join('\n');
}
