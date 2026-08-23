// Etiquetas en espanol para las categorias de hueco. Se comparten entre servidor
// y cliente, por eso viven fuera de los modulos con 'server-only'.

export const TAG_LABEL: Record<string, string> = {
  phrasal_verb: 'phrasal verb',
  preposition: 'preposicion',
  connector: 'conector',
  comparative: 'comparativo',
  conditional: 'condicional',
  verb_form: 'forma verbal',
  modal: 'modal',
  contraction: 'contraccion',
  vocab: 'vocabulario',
};

export const VERDICT_LABEL: Record<string, string> = {
  correct: 'correcto',
  typo: 'casi (typo)',
  wrong: 'incorrecto',
  skipped: 'en blanco',
};

export const LEVEL_HELP: Record<string, string> = {
  easy: 'Banco de palabras visible arriba.',
  medium: 'Se muestra la inicial y la longitud.',
  hard: 'Hueco vacio, sin pistas.',
};
