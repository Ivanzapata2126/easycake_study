// Phrasal verbs: el candidato de mayor valor pedagogico en un fill-in-the-blank.
// Se indexan por verbo base y se reconocen tambien las formas conjugadas
// (looked up, looking up) y la forma separada (look it up, pick them up).

/** verbo base -> particulas con las que forma phrasal verb */
export const PHRASAL_VERBS: Record<string, string[]> = {
  ask: ['out', 'for', 'around'],
  back: ['up', 'down', 'off'],
  blow: ['up', 'out', 'over'],
  break: ['down', 'up', 'in', 'out', 'off', 'through', 'into'],
  bring: ['up', 'back', 'about', 'along', 'in', 'out', 'down'],
  call: ['off', 'back', 'up', 'on', 'in', 'out', 'for'],
  calm: ['down'],
  carry: ['on', 'out', 'off'],
  catch: ['up', 'on', 'out'],
  check: ['in', 'out', 'up', 'off'],
  cheer: ['up'],
  clean: ['up', 'out'],
  clear: ['up', 'out', 'off'],
  come: ['back', 'in', 'out', 'across', 'along', 'up', 'over', 'down', 'about', 'apart', 'around'],
  count: ['on', 'in', 'out'],
  cut: ['off', 'down', 'out', 'back', 'up'],
  deal: ['with'],
  do: ['over', 'without', 'up', 'away'],
  drop: ['off', 'out', 'by', 'in'],
  eat: ['out', 'up'],
  end: ['up'],
  fall: ['apart', 'behind', 'through', 'out', 'back', 'for', 'over'],
  figure: ['out'],
  fill: ['in', 'out', 'up'],
  find: ['out'],
  get: ['up', 'along', 'over', 'through', 'by', 'off', 'on', 'out', 'away', 'back', 'around', 'into', 'ahead', 'together', 'rid'],
  give: ['up', 'in', 'away', 'back', 'out', 'off'],
  go: ['on', 'out', 'over', 'through', 'back', 'ahead', 'along', 'off', 'down', 'up', 'after', 'without'],
  grow: ['up', 'apart', 'into', 'out'],
  hand: ['in', 'out', 'over', 'down'],
  hang: ['out', 'up', 'on', 'around', 'back'],
  head: ['back', 'out', 'off'],
  hold: ['on', 'up', 'back', 'off', 'out'],
  keep: ['up', 'on', 'off', 'out', 'away'],
  kick: ['off', 'out'],
  knock: ['out', 'off', 'down'],
  lay: ['off', 'out', 'down'],
  leave: ['out', 'behind', 'off'],
  let: ['down', 'in', 'out', 'off'],
  log: ['in', 'out', 'on', 'off'],
  look: ['up', 'for', 'after', 'into', 'out', 'forward', 'down', 'over', 'through', 'back'],
  make: ['up', 'out', 'off', 'for'],
  mix: ['up'],
  move: ['on', 'in', 'out', 'over', 'back'],
  pass: ['out', 'away', 'on', 'by', 'up'],
  pay: ['off', 'back', 'for', 'up'],
  pick: ['up', 'out', 'on'],
  point: ['out'],
  pull: ['over', 'off', 'out', 'through', 'up', 'down'],
  push: ['back', 'through', 'for'],
  put: ['off', 'on', 'up', 'out', 'away', 'down', 'back', 'through', 'together', 'aside', 'in', 'forward'],
  ring: ['up', 'back'],
  run: ['into', 'out', 'over', 'away', 'through', 'up', 'by'],
  set: ['up', 'off', 'out', 'back', 'aside', 'down'],
  settle: ['down', 'in', 'for'],
  show: ['up', 'off', 'around'],
  shut: ['down', 'up', 'off'],
  sign: ['up', 'in', 'out', 'off'],
  sit: ['down', 'back', 'in', 'out', 'around', 'through'],
  sort: ['out'],
  sound: ['like'],
  speak: ['up', 'out'],
  stand: ['up', 'out', 'by', 'for', 'back', 'around'],
  stay: ['up', 'out', 'in', 'over', 'away'],
  stick: ['to', 'with', 'out', 'around'],
  take: ['off', 'on', 'over', 'up', 'out', 'back', 'in', 'down', 'apart', 'after'],
  talk: ['about', 'over', 'into', 'out'],
  tear: ['down', 'up', 'apart'],
  think: ['about', 'over', 'through', 'up', 'of'],
  throw: ['away', 'out', 'up', 'in'],
  try: ['out', 'on'],
  turn: ['on', 'off', 'up', 'down', 'out', 'over', 'around', 'into', 'back', 'in'],
  wake: ['up'],
  walk: ['out', 'away', 'in', 'through'],
  warm: ['up'],
  wash: ['up', 'off'],
  watch: ['out', 'over'],
  wear: ['out', 'off', 'down'],
  wind: ['up', 'down'],
  wipe: ['out', 'off'],
  work: ['out', 'on', 'through', 'up'],
  wrap: ['up'],
  write: ['down', 'up', 'off'],

  // Añadidos tras revisar los dictados: faltaban y dejaban huecos partidos
  // ("I was so [pissed] off", "I [printed] out my proposal").
  piss: ['off'],
  print: ['out', 'off'],
  loaf: ['around'],
  mess: ['up', 'around', 'with'],
  chill: ['out'],
  burn: ['out', 'down'],
  cross: ['out', 'off'],
  dress: ['up', 'down'],
  freak: ['out'],
  hurry: ['up'],
  lighten: ['up'],
  rule: ['out'],
  save: ['up'],
  screw: ['up'],
  slow: ['down'],
  spell: ['out'],
  sum: ['up'],
  switch: ['on', 'off', 'over'],
  tidy: ['up'],
  track: ['down'],
  use: ['up'],
  weigh: ['up'],
  own: ['up'],
  opt: ['out', 'in'],
  plug: ['in'],
  pop: ['up', 'in', 'out'],
  pile: ['up'],
  tone: ['down'],
  top: ['up'],
};

/**
 * Pasados/participios irregulares de los verbos de arriba.
 * forma conjugada -> base. Sin esto "brought up" o "went through" no se detectan.
 */
export const IRREGULAR_TO_BASE: Record<string, string> = {
  asked: 'ask', blew: 'blow', blown: 'blow', broke: 'break', broken: 'break',
  brought: 'bring', called: 'call', came: 'come', caught: 'catch', cut: 'cut',
  did: 'do', done: 'do', ate: 'eat', eaten: 'eat', fell: 'fall', fallen: 'fall',
  found: 'find', got: 'get', gotten: 'get', gave: 'give', given: 'give',
  went: 'go', gone: 'go', grew: 'grow', grown: 'grow', hung: 'hang',
  held: 'hold', kept: 'keep', laid: 'lay', left: 'leave', let: 'let',
  made: 'make', paid: 'pay', put: 'put', rang: 'ring', rung: 'ring',
  ran: 'run', run: 'run', set: 'set', showed: 'show', shown: 'show',
  shut: 'shut', sat: 'sit', spoke: 'speak', spoken: 'speak', stood: 'stand',
  stuck: 'stick', took: 'take', taken: 'take', tore: 'tear', torn: 'tear',
  thought: 'think', threw: 'throw', thrown: 'throw', woke: 'wake', woken: 'wake',
  wore: 'wear', worn: 'wear', wrote: 'write', written: 'write',
};

/** Pronombres que pueden ir entre verbo y particula: "look IT up". */
export const INTERPOSED_PRONOUNS = new Set([
  'it', 'them', 'him', 'her', 'me', 'us', 'you', 'this', 'that', 'these', 'those',
]);

/**
 * Reduce una forma conjugada a su base probable. Es deliberadamente aproximado:
 * solo se usa para preguntar "existe este verbo en PHRASAL_VERBS?", asi que un
 * falso negativo cuesta un candidato perdido, no un hueco malo.
 */
export function toBaseVerb(word: string): string[] {
  const w = word.toLowerCase();
  const out = new Set<string>([w]);

  if (IRREGULAR_TO_BASE[w]) out.add(IRREGULAR_TO_BASE[w]);

  if (w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    out.add(stem);
    out.add(stem + 'e');                                  // making -> make
    if (/(.)\1$/.test(stem)) out.add(stem.slice(0, -1));  // running -> run
  }
  if (w.endsWith('ed')) {
    const stem = w.slice(0, -2);
    out.add(stem);
    out.add(stem + 'e');                                  // moved -> move
    if (/(.)\1$/.test(stem)) out.add(stem.slice(0, -1));  // dropped -> drop
  }
  if (w.endsWith('ied')) out.add(w.slice(0, -3) + 'y');   // carried -> carry
  if (w.endsWith('ies')) out.add(w.slice(0, -3) + 'y');   // carries -> carry
  if (w.endsWith('es')) out.add(w.slice(0, -2));          // goes -> go
  if (w.endsWith('s') && !w.endsWith('ss')) out.add(w.slice(0, -1));

  return [...out];
}
