// Analizador heuristico: recibe el texto de una linea y devuelve todos los tramos
// que valen la pena tapar, con su dificultad y su categoria.
//
// Se corre UNA VEZ, al guardar el script. El quiz despues solo muestrea de aqui.
// Por eso puede permitirse ser exhaustivo: genera 60-90 candidatos para un dialogo
// de 600 palabras y el sampler elige 15 distintos en cada intento.

import {
  STOPWORDS, COMMON_TIER1, COMMON_TIER2, CONNECTORS, IRREGULAR_FORMS, MODALS,
  DEPENDENT_PREPOSITIONS, CONTRACTIONS, DISTRACTOR_POOL,
} from './wordlists';
import { PHRASAL_VERBS, INTERPOSED_PRONOUNS, toBaseVerb } from './phrasals';

export type CandidateTag =
  | 'phrasal_verb' | 'preposition' | 'connector'
  | 'verb_form' | 'modal' | 'contraction' | 'vocab';

export interface RawCandidate {
  start: number;
  end: number;
  answer: string;
  altAnswers: string[];
  distractors: string[];
  difficulty: number;   // 1..5
  tag: CandidateTag;
  reason: string;
}

interface Token {
  text: string;
  lower: string;
  start: number;
  end: number;
  sentenceStart: boolean;
}

/** Palabras de 1-3 letras que igual valen como hueco (preposiciones, modales cortos). */
const SHORT_ALLOWED = new Set(['in', 'on', 'at', 'to', 'of', 'up', 'off', 'out', 'for', 'by']);

const WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;

  while ((m = WORD_RE.exec(text)) !== null) {
    const start = m.index;
    // Inicio de oracion = primer token, o precedido por . ! ? : ; (ignorando espacios y comillas)
    let sentenceStart = true;
    for (let i = start - 1; i >= 0; i--) {
      const ch = text[i];
      if (/[\s"'‘’“”(\[]/.test(ch)) continue;
      sentenceStart = /[.!?:;]/.test(ch);
      break;
    }
    tokens.push({
      text: m[0],
      lower: m[0].toLowerCase().replace(/’/g, "'"),
      start,
      end: start + m[0].length,
      sentenceStart,
    });
  }
  return tokens;
}

/** Nombre propio: mayuscula inicial fuera de inicio de oracion. Nunca es un buen hueco. */
function isProperNoun(tok: Token): boolean {
  return !tok.sentenceStart && /^[A-Z]/.test(tok.text);
}

/**
 * Detecta todos los candidatos de una linea y resuelve los solapes.
 * `speaker` se pasa para no proponer el nombre del hablante como hueco.
 */
export function analyzeLine(text: string, speaker?: string | null): RawCandidate[] {
  const tokens = tokenize(text);

  // Una linea de 3 palabras no da contexto suficiente para deducir nada.
  if (tokens.length < 4) return [];

  const speakerWords = new Set(
    (speaker || '').toLowerCase().split(/\s+/).filter(Boolean),
  );

  // [candidato, prioridad] — la prioridad decide quien gana un solape.
  const found: Array<{ c: RawCandidate; priority: number }> = [];
  const used = new Set<number>(); // indices de token ya consumidos por un phrasal

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    // --- 1. Phrasal verbs (prioridad maxima) ---
    for (const base of toBaseVerb(tok.lower)) {
      const particles = PHRASAL_VERBS[base];
      if (!particles) continue;

      const next = tokens[i + 1];
      const after = tokens[i + 2];

      if (next && particles.includes(next.lower)) {
        // Forma junta: "look up" -> se tapa el phrasal completo.
        found.push({
          priority: 100,
          c: {
            start: tok.start, end: next.end,
            answer: text.slice(tok.start, next.end),
            altAnswers: [], distractors: [],
            difficulty: 5, tag: 'phrasal_verb',
            reason: `phrasal verb "${base} ${next.lower}"`,
          },
        });
        used.add(i); used.add(i + 1);
        break;
      }

      if (next && after && INTERPOSED_PRONOUNS.has(next.lower) && particles.includes(after.lower)) {
        // Forma separada: "look it up" -> solo se tapa la particula.
        found.push({
          priority: 95,
          c: {
            start: after.start, end: after.end,
            answer: text.slice(after.start, after.end),
            altAnswers: [], distractors: [],
            difficulty: 4, tag: 'phrasal_verb',
            reason: `particula del phrasal separado "${base} ... ${after.lower}"`,
          },
        });
        used.add(i + 2);
        break;
      }
    }

    // --- 2. Preposicion dependiente: se tapa SOLO la preposicion ---
    const preps = DEPENDENT_PREPOSITIONS[tok.lower];
    const nextTok = tokens[i + 1];
    if (preps && nextTok && preps.includes(nextTok.lower)) {
      found.push({
        priority: 90,
        c: {
          start: nextTok.start, end: nextTok.end,
          answer: text.slice(nextTok.start, nextTok.end),
          altAnswers: preps.filter((p) => p !== nextTok.lower),
          distractors: [],
          difficulty: 4, tag: 'preposition',
          reason: `preposicion dependiente de "${tok.lower}"`,
        },
      });
    }

    // --- 3. Conectores del discurso ---
    if (CONNECTORS.has(tok.lower)) {
      found.push({
        priority: 80,
        c: {
          start: tok.start, end: tok.end, answer: tok.text,
          altAnswers: [], distractors: [],
          difficulty: 4, tag: 'connector',
          reason: 'conector / marcador del discurso',
        },
      });
      continue;
    }

    // --- 4. Formas verbales irregulares ---
    if (IRREGULAR_FORMS.has(tok.lower) && !STOPWORDS.has(tok.lower)) {
      found.push({
        priority: 70,
        c: {
          start: tok.start, end: tok.end, answer: tok.text,
          altAnswers: [], distractors: [],
          difficulty: 3, tag: 'verb_form',
          reason: 'forma irregular (pasado / participio)',
        },
      });
      continue;
    }

    // --- 5. Modales ---
    // can/will/may/need/used quedan fuera: son demasiado ambiguos sin contexto.
    if (MODALS.has(tok.lower) && !['can', 'will', 'may', 'need', 'used', 'dare'].includes(tok.lower)) {
      found.push({
        priority: 60,
        c: {
          start: tok.start, end: tok.end, answer: tok.text,
          altAnswers: [], distractors: [],
          difficulty: 3, tag: 'modal',
          reason: 'verbo modal',
        },
      });
      continue;
    }

    // --- 6. Contracciones ---
    if (CONTRACTIONS[tok.lower]) {
      found.push({
        priority: 30,
        c: {
          start: tok.start, end: tok.end, answer: tok.text,
          altAnswers: [CONTRACTIONS[tok.lower]],
          distractors: [],
          difficulty: 2, tag: 'contraction',
          reason: 'contraccion',
        },
      });
      continue;
    }

    // --- 7. Vocabulario de contenido ---
    if (used.has(i)) continue;
    if (isProperNoun(tok)) continue;
    if (speakerWords.has(tok.lower)) continue;
    if (STOPWORDS.has(tok.lower) && !SHORT_ALLOWED.has(tok.lower)) continue;
    if (tok.lower.length < 4) continue;
    if (COMMON_TIER1.has(tok.lower)) continue;

    if (COMMON_TIER2.has(tok.lower)) {
      found.push({
        priority: 20,
        c: {
          start: tok.start, end: tok.end, answer: tok.text,
          altAnswers: [], distractors: [],
          difficulty: 2, tag: 'vocab',
          reason: 'vocabulario frecuente',
        },
      });
    } else {
      // Fuera de las listas de frecuencia = poco comun = probablemente lo interesante.
      const difficulty = tok.lower.length >= 9 ? 5 : tok.lower.length >= 7 ? 4 : 3;
      found.push({
        priority: 50,
        c: {
          start: tok.start, end: tok.end, answer: tok.text,
          altAnswers: [], distractors: [],
          difficulty, tag: 'vocab',
          reason: 'vocabulario poco frecuente',
        },
      });
    }
  }

  return resolveOverlaps(found);
}

/**
 * Dos huecos no pueden pisarse. Gana el de mayor prioridad; a igual prioridad,
 * el mas dificil. Greedy sobre la lista ordenada.
 */
function resolveOverlaps(found: Array<{ c: RawCandidate; priority: number }>): RawCandidate[] {
  const sorted = [...found].sort(
    (a, b) => b.priority - a.priority || b.c.difficulty - a.c.difficulty || a.c.start - b.c.start,
  );

  const accepted: RawCandidate[] = [];
  for (const { c } of sorted) {
    const clashes = accepted.some((a) => c.start < a.end && a.start < c.end);
    if (!clashes) accepted.push(c);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

/**
 * Rellena `distractors` mirando el script completo: los mejores distractores son
 * palabras que aparecen en el mismo texto y la misma categoria, porque suenan
 * plausibles. Si no alcanzan, se completa con el pool generico.
 */
export function fillDistractors(all: RawCandidate[]): void {
  const byTag = new Map<CandidateTag, string[]>();
  for (const c of all) {
    const list = byTag.get(c.tag) ?? [];
    list.push(c.answer.toLowerCase());
    byTag.set(c.tag, list);
  }

  for (const c of all) {
    const answer = c.answer.toLowerCase();
    const pool = new Set(
      (byTag.get(c.tag) ?? []).filter((w) => w !== answer),
    );
    for (const w of DISTRACTOR_POOL[c.tag] ?? []) {
      if (w !== answer) pool.add(w);
    }
    c.distractors = shuffle([...pool]).slice(0, 3);
  }
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
