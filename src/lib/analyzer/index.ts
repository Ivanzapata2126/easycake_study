// Analizador heuristico: recibe el texto de una linea y devuelve todos los tramos
// que valen la pena tapar, con su dificultad y su categoria.
//
// Se corre UNA VEZ, al guardar el script. El quiz despues solo muestrea de aqui.
// Por eso puede permitirse ser exhaustivo: genera 60-90 candidatos para un dialogo
// de 600 palabras y el sampler elige 15 distintos en cada intento.

import {
  STOPWORDS, COMMON_TIER1, COMMON_TIER2, CONNECTORS, IRREGULAR_FORMS, MODALS,
  DEPENDENT_PREPOSITIONS, CONTRACTIONS, DISTRACTOR_POOL,
  TRANSPORT_MEANS, IRREGULAR_COMPARATIVES, NOT_COMPARATIVE, NOT_PHRASAL,
  TIME_NOUNS, SKIP_AUXILIARIES,
} from './wordlists';
import { PHRASAL_VERBS, INTERPOSED_PRONOUNS, toBaseVerb } from './phrasals';

export type CandidateTag =
  | 'phrasal_verb' | 'preposition' | 'connector' | 'comparative' | 'conditional'
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

/**
 * Palabras que el analizador reconoce como comunes. Si una mayuscula de inicio
 * de frase esta aqui, no es nombre propio.
 */
const KNOWN_WORDS = new Set<string>([
  ...STOPWORDS, ...COMMON_TIER1, ...COMMON_TIER2, ...CONNECTORS,
  ...IRREGULAR_FORMS, ...MODALS, ...TRANSPORT_MEANS, ...IRREGULAR_COMPARATIVES,
  ...Object.keys(CONTRACTIONS), ...Object.keys(DEPENDENT_PREPOSITIONS),
]);

/**
 * Nombre propio: nunca es un buen hueco.
 *
 * En medio de la frase basta la mayuscula. Al INICIO de frase la mayuscula es
 * obligatoria y no informa de nada, asi que se decide de otro modo: si la
 * palabra no esta en las listas de vocabulario comun y tampoco aparece en
 * minuscula en ningun otro punto del script, es un nombre propio. Asi
 * "Winnipeg" queda fuera y "Going" o "Three" —que aparecen en minuscula mas
 * adelante— siguen siendo candidatos.
 */
function isProperNoun(tok: Token, scriptVocab?: Set<string>): boolean {
  if (!/^[A-Z]/.test(tok.text)) return false;
  if (!tok.sentenceStart) return true;
  if (!scriptVocab) return false;            // sin contexto de script, no se arriesga
  if (KNOWN_WORDS.has(tok.lower)) return false;
  // Variantes morfologicas: "Going" reduce a "go", que si es palabra comun.
  if (toBaseVerb(tok.lower).some((base) => KNOWN_WORDS.has(base))) return false;
  return !scriptVocab.has(tok.lower);
}

/**
 * Formas en minuscula que aparecen en el script. Alimenta la deteccion de
 * nombres propios al inicio de frase.
 */
export function scriptVocabulary(texts: string[]): Set<string> {
  const vocab = new Set<string>();
  for (const text of texts) {
    for (const tok of tokenize(text)) {
      if (!/^[A-Z]/.test(tok.text)) vocab.add(tok.lower);
    }
  }
  return vocab;
}

/**
 * Detecta todos los candidatos de una linea y resuelve los solapes.
 * `speaker` se pasa para no proponer el nombre del hablante como hueco.
 */
export function analyzeLine(
  text: string,
  speaker?: string | null,
  scriptVocab?: Set<string>,
): RawCandidate[] {
  const tokens = tokenize(text);

  // Una linea de 3 palabras no da contexto suficiente para deducir nada.
  if (tokens.length < 4) return [];

  const speakerWords = new Set(
    (speaker || '').toLowerCase().split(/\s+/).filter(Boolean),
  );

  // Un `if` en la linea cambia el valor de los modales: "could" suelto es un
  // modal cualquiera, pero en "if it had been me, you could..." es la marca del
  // condicional, que es lo que de verdad se practica.
  const hayIf = tokens.some((t) => t.lower === 'if');

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

      // "go on foot" no es el phrasal "go on": la unidad es "on foot".
      const trio = next && `${base} ${next.lower} ${tokens[i + 2]?.lower ?? ''}`.trim();
      // "held on Wednesdays" tampoco: ahi "on" introduce un complemento de tiempo.
      const siguiente = tokens[i + 2]?.lower ?? '';
      const esTiempo = ['on', 'in', 'at'].includes(next?.lower ?? '')
        && (TIME_NOUNS.has(siguiente) || TIME_NOUNS.has(siguiente.replace(/s$/, '')));

      if (next && particles.includes(next.lower)
          && !NOT_PHRASAL.has(trio as string) && !esTiempo) {
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

    // --- 2. Medio de transporte: "by car", "on foot". Se tapa la preposicion ---
    const nx = tokens[i + 1];
    if (nx && TRANSPORT_MEANS.has(nx.lower)
        && ((tok.lower === 'by' && nx.lower !== 'foot') || (tok.lower === 'on' && nx.lower === 'foot'))) {
      found.push({
        priority: 92,
        c: {
          start: tok.start, end: tok.end, answer: tok.text,
          altAnswers: [], distractors: [],
          difficulty: 4, tag: 'preposition',
          reason: `preposicion de medio de transporte ("${tok.lower} ${nx.lower}")`,
        },
      });
    }

    // --- 3. Comparativos: se tapa la forma comparativa, no el "than" ---
    if (nx && nx.lower === 'than' && !NOT_COMPARATIVE.has(tok.lower)) {
      const esComparativo = IRREGULAR_COMPARATIVES.has(tok.lower)
        || (tok.lower.endsWith('er') && tok.lower.length >= 5);
      if (esComparativo) {
        found.push({
          priority: 85,
          c: {
            start: tok.start, end: tok.end, answer: tok.text,
            altAnswers: [], distractors: [],
            difficulty: 4, tag: 'comparative',
            reason: `comparativo ("${tok.lower} than")`,
          },
        });
        continue;
      }
    }
    // Forma perifrastica: "more expensive than" -> se tapa "more"/"less".
    if ((tok.lower === 'more' || tok.lower === 'less') && nx && tokens[i + 2]?.lower === 'than') {
      found.push({
        priority: 85,
        c: {
          start: tok.start, end: tok.end, answer: tok.text,
          altAnswers: [], distractors: [],
          difficulty: 4, tag: 'comparative',
          reason: `comparativo perifrastico ("${tok.lower} ${nx.lower} than")`,
        },
      });
      continue;
    }

    // --- 4. Preposicion dependiente: se tapa SOLO la preposicion ---
    const preps = DEPENDENT_PREPOSITIONS[tok.lower];
    const nextTok = nx;
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

    // --- Condicionales (solo en lineas con "if") ---
    if (hayIf) {
      // 3er condicional: "If it HAD BEEN me...". `had` y `been` son palabras
      // funcionales y por separado no se tocan nunca; juntas son la estructura.
      if (tok.lower === 'had' && nx && (IRREGULAR_FORMS.has(nx.lower) || /ed$/.test(nx.lower))) {
        found.push({
          priority: 88,
          c: {
            start: tok.start, end: tok.end, answer: tok.text,
            altAnswers: [], distractors: [],
            difficulty: 5, tag: 'conditional',
            reason: `tercer condicional ("had ${nx.lower}")`,
          },
        });
        continue;
      }
      // Condicional perfecto: "would have done" -> se tapa "would have" entero.
      if (['would', 'could', 'might', 'should'].includes(tok.lower) && nx?.lower === 'have') {
        found.push({
          priority: 88,
          c: {
            start: tok.start, end: nx.end,
            answer: text.slice(tok.start, nx.end),
            altAnswers: [], distractors: [],
            difficulty: 5, tag: 'conditional',
            reason: `condicional perfecto ("${tok.lower} have")`,
          },
        });
        used.add(i + 1);
        continue;
      }
      // Segundo condicional: el modal de la oracion principal.
      if (['would', 'could', 'might'].includes(tok.lower)) {
        found.push({
          priority: 88,
          c: {
            start: tok.start, end: tok.end, answer: tok.text,
            altAnswers: [], distractors: [],
            difficulty: 4, tag: 'conditional',
            reason: 'modal de condicional',
          },
        });
        continue;
      }
      // "I'd buy him drinks" -> la 'd es `would`, no una contraccion cualquiera.
      if (CONTRACTIONS[tok.lower]?.endsWith(' would')) {
        found.push({
          priority: 88,
          c: {
            start: tok.start, end: tok.end, answer: tok.text,
            altAnswers: [CONTRACTIONS[tok.lower]],
            distractors: [],
            difficulty: 4, tag: 'conditional',
            reason: `"'d" = would en condicional`,
          },
        });
        continue;
      }
    }

    // --- 5. Conectores del discurso ---
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

    // --- 6. Formas verbales irregulares ---
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

    // --- 7. Modales ---
    // Los auxiliares puros (can/will/may/shall) se descartan enteros: no son
    // buen hueco de modal y tampoco son vocabulario de contenido. El `continue`
    // es lo importante — sin el caian al filtro de vocabulario mas abajo.
    if (SKIP_AUXILIARIES.has(tok.lower)) continue;

    // need/used/dare si siguen adelante: fuera de "used to" y "need to" son
    // verbos plenos y como vocabulario funcionan bien.
    if (MODALS.has(tok.lower) && !['need', 'used', 'dare'].includes(tok.lower)) {
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

    // --- 8. Contracciones ---
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

    // --- 9. Vocabulario de contenido ---
    if (used.has(i)) continue;
    if (isProperNoun(tok, scriptVocab)) continue;
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

/**
 * Las contracciones son abundantes y faciles: en un dialogo informal pueden ser
 * un cuarto de los candidatos y ahogan lo que de verdad ensena el script. Se
 * queda un subconjunto repartido por todo el texto, no los primeros.
 */
export function capContractions<T extends { tag: CandidateTag }>(
  all: T[],
  maxShare = 0.15,
): T[] {
  const contractions = all.filter((c) => c.tag === 'contraction');
  const otros = all.length - contractions.length;

  // El limite se despeja sobre el total FINAL, no sobre el de partida: si se
  // calcula con all.length, al podar baja el denominador y la proporcion real
  // acaba por encima de maxShare.
  //     k / (otros + k) <= maxShare   ->   k <= maxShare * otros / (1 - maxShare)
  const limit = Math.max(2, Math.floor((maxShare * otros) / (1 - maxShare)));
  if (contractions.length <= limit) return all;

  // Reparto uniforme: se toma 1 de cada `paso` para no concentrarlas al inicio.
  const paso = contractions.length / limit;
  const keep = new Set<T>();
  for (let i = 0; i < limit; i++) keep.add(contractions[Math.floor(i * paso)]);

  return all.filter((c) => c.tag !== 'contraction' || keep.has(c));
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
