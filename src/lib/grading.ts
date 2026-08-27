// Correccion de respuestas. La regla de oro: `===` no sirve.
// Un typo de una letra en "receive" no es lo mismo que no saber la palabra, y
// tratarlos igual es lo que vuelve inutilizables estas apps.

import { CONTRACTIONS } from './analyzer/wordlists';

export type Verdict = 'correct' | 'typo' | 'wrong' | 'skipped';

export interface GradeResult {
  verdict: Verdict;
  /** Forma exacta esperada, para mostrarla cuando hubo typo o error. */
  expected: string;
}

/** minusculas, comillas tipograficas normalizadas, sin puntuacion de borde, espacios colapsados */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/^[^\w']+|[^\w']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "i'm" -> "i am". Permite que ambas formas se acepten indistintamente. */
export function expandContractions(s: string): string {
  return s
    .split(' ')
    .map((w) => CONTRACTIONS[w] ?? w)
    .join(' ');
}

/**
 * Damerau-Levenshtein (optimal string alignment): cuenta la transposicion de dos
 * letras adyacentes como UNA edicion, no como dos.
 *
 * No es un detalle menor. "recieve" por "receive" es el typo mas comun del ingles
 * y con Levenshtein normal queda a distancia 2, o sea marcado como error. Con
 * transposiciones queda a 1 y se corrige como typo, que es lo que realmente es.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // d[i][j] = distancia entre los prefijos a[0..i) y b[0..j)
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,          // borrado
        d[i][j - 1] + 1,          // insercion
        d[i - 1][j - 1] + cost,   // sustitucion
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);  // transposicion
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Cascada de correccion:
 *   1. match exacto normalizado
 *   2. match contra las respuestas alternativas
 *   3. equivalencia de contracciones en ambos sentidos
 *   4. distancia de Levenshtein <= 1 -> "typo" (cuenta como acierto, muestra la forma correcta)
 *   5. incorrecto
 */
export function grade(
  userAnswer: string | null | undefined,
  answer: string,
  altAnswers: string[] = [],
): GradeResult {
  const expected = answer;
  const user = normalize(userAnswer ?? '');
  if (!user) return { verdict: 'skipped', expected };

  const targets = [answer, ...altAnswers].map(normalize).filter(Boolean);

  if (targets.includes(user)) return { verdict: 'correct', expected };

  const userExpanded = expandContractions(user);
  if (targets.some((t) => expandContractions(t) === userExpanded)) {
    return { verdict: 'correct', expected };
  }

  // Tolerancia a typos, solo en respuestas de 4+ caracteres: en palabras de 2-3
  // letras (in / on / at) una edicion de distancia es una respuesta distinta,
  // no un error de tecleo.
  const tolerant = targets.filter((t) => t.length >= 4);
  if (tolerant.some((t) => levenshtein(user, t) <= 1)) {
    return { verdict: 'typo', expected };
  }

  // Excepcion a lo anterior: en respuestas de 3 letras (las particulas de los
  // phrasal verbs: out, off, for) SI se acepta la transposicion de dos letras.
  // "uot" por "out" es teclear mal; "our" por "out" es responder otra cosa.
  if (targets.some((t) => t.length === 3 && isTransposition(user, t))) {
    return { verdict: 'typo', expected };
  }
  // En respuestas largas (frases, phrasal verbs) se admiten 2 ediciones.
  if (targets.some((t) => t.length >= 9 && levenshtein(user, t) <= 2)) {
    return { verdict: 'typo', expected };
  }

  return { verdict: 'wrong', expected };
}

/** true si `a` es `b` con exactamente dos letras adyacentes intercambiadas. */
function isTransposition(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const diff: number[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff.push(i);
    if (diff.length > 2) return false;
  }
  if (diff.length !== 2) return false;
  const [i, j] = diff;
  return j === i + 1 && a[i] === b[j] && a[j] === b[i];
}

/** Un typo cuenta como acierto para el puntaje: sabias la palabra. */
export function isSuccess(v: Verdict): boolean {
  return v === 'correct' || v === 'typo';
}

/** Pista del modo medio: "l___ u_" conserva la forma de la palabra. */
export function buildHint(answer: string): string {
  return answer
    .split(/(\s+)/)
    .map((chunk) => {
      if (/^\s+$/.test(chunk)) return chunk;
      if (chunk.length <= 1) return chunk;
      return chunk[0] + '_'.repeat(chunk.length - 1);
    })
    .join('');
}

// ---------------------------------------------------- frases completas

export type WordStatus = 'ok' | 'typo' | 'wrong' | 'missing' | 'extra';

export interface WordDiff {
  /** Lo que escribio el usuario, o la palabra esperada si la omitio. */
  word: string;
  /** La forma correcta, cuando difiere de `word`. */
  expected?: string;
  status: WordStatus;
}

export interface SentenceResult {
  diff: WordDiff[];
  /** Palabras acertadas sobre las esperadas. */
  matched: number;
  total: number;
  verdict: Verdict;
}

/**
 * Parte en palabras EXPANDIENDO las contracciones antes.
 *
 * "I'm" equivale a "I am": una palabra contra dos. Comparando palabra a palabra
 * esa equivalencia es inexpresable y "I'm ready" contra "I am ready" salia como
 * error. Expandiendo ambos lados el alineamiento las ve iguales.
 */
function splitWords(s: string): string[] {
  return expandContractions(normalize(s)).split(' ').filter(Boolean);
}

/** Dos palabras "iguales" a efectos de alineacion: exacta, contraccion o typo. */
function sameWord(a: string, b: string): WordStatus | null {
  if (a === b) return 'ok';
  if (expandContractions(a) === expandContractions(b)) return 'ok';
  if (b.length >= 4 && levenshtein(a, b) <= 1) return 'typo';
  if (b.length === 3 && levenshtein(a, b) <= 1 && a.length === 3) return 'typo';
  return null;
}

/**
 * Compara la frase escrita contra la esperada, palabra por palabra.
 *
 * Se alinea con programacion dinamica (tipo Needleman-Wunsch) en vez de comparar
 * por indice: si el usuario se salta o agrega UNA palabra, un cotejo posicional
 * marcaria como erroneo todo lo que viene despues, que es exactamente el
 * feedback inutil que hay que evitar.
 */
export function diffSentence(userAnswer: string | null | undefined, expected: string): SentenceResult {
  const user = splitWords(userAnswer ?? '');
  const want = splitWords(expected);

  if (!user.length) {
    return {
      diff: want.map((w) => ({ word: w, status: 'missing' as WordStatus })),
      matched: 0, total: want.length, verdict: 'skipped',
    };
  }

  // d[i][j] = coste minimo de alinear user[0..i) con want[0..j)
  const d: number[][] = Array.from({ length: user.length + 1 }, (_, i) =>
    Array.from({ length: want.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= user.length; i++) {
    for (let j = 1; j <= want.length; j++) {
      const m = sameWord(user[i - 1], want[j - 1]);
      const coste = m === 'ok' ? 0 : m === 'typo' ? 0.5 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + coste);
    }
  }

  // Reconstruccion del camino, de atras hacia adelante.
  const diff: WordDiff[] = [];
  let i = user.length;
  let j = want.length;
  let matched = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const m = sameWord(user[i - 1], want[j - 1]);
      const coste = m === 'ok' ? 0 : m === 'typo' ? 0.5 : 1;
      if (d[i][j] === d[i - 1][j - 1] + coste) {
        if (m === 'ok') { diff.push({ word: user[i - 1], status: 'ok' }); matched++; }
        else if (m === 'typo') { diff.push({ word: user[i - 1], expected: want[j - 1], status: 'typo' }); matched++; }
        else diff.push({ word: user[i - 1], expected: want[j - 1], status: 'wrong' });
        i--; j--;
        continue;
      }
    }
    if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      diff.push({ word: want[j - 1], status: 'missing' });   // falto escribirla
      j--;
    } else {
      diff.push({ word: user[i - 1], status: 'extra' });     // sobra
      i--;
    }
  }
  diff.reverse();

  const hayTypos = diff.some((w) => w.status === 'typo');
  const hayFallos = diff.some((w) => w.status === 'wrong' || w.status === 'missing' || w.status === 'extra');
  const verdict: Verdict = hayFallos ? 'wrong' : hayTypos ? 'typo' : 'correct';

  return { diff, matched, total: want.length, verdict };
}
