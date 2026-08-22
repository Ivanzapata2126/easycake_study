import type { CandidateTag } from './analyzer';

export type { CandidateTag };

export interface ScriptRow {
  id: number;
  user_id: number;
  is_public: boolean;
  owner_username?: string;
  title: string;
  topic: string | null;
  level: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScriptSummary extends ScriptRow {
  line_count: number;
  candidate_count: number;
  speakers: string[];
  is_owner: boolean;
  owner_username: string;
}

export interface LineRow {
  id: number;
  script_id: number;
  ord: number;
  speaker: string | null;
  text: string;
}

export interface CandidateRow {
  id: number;
  line_id: number;
  script_id: number;
  start_pos: number;
  end_pos: number;
  answer: string;
  alt_answers: string[];
  distractors: string[];
  difficulty: number;
  tag: CandidateTag;
  reason: string | null;
  enabled: boolean;
}

export type QuizMode = 'script' | 'general' | 'speaker';
export type QuizLevel = 'easy' | 'medium' | 'hard';

export interface QuizConfig {
  mode: QuizMode;
  scriptId?: number;
  speaker?: string;
  level: QuizLevel;
  /** Proporcion de huecos sobre el texto: 0.10 | 0.20 | 0.30 */
  density: number;
  /** Tope duro de huecos (para que un script largo no genere un examen eterno). */
  maxBlanks: number;
  /** Solo en modo general: cuantos pasajes mezclar. */
  passages?: number;
}

export interface QuizSegment {
  type: 'text' | 'blank';
  value: string;        // texto literal, o '' si es hueco
  blankIndex?: number;  // indice dentro de quiz.blanks
}

export interface QuizLine {
  lineId: number;
  speaker: string | null;
  segments: QuizSegment[];
}

export interface QuizPassage {
  scriptId: number;
  scriptTitle: string;
  lines: QuizLine[];
}

export interface QuizBlank {
  candidateId: number;
  tag: CandidateTag;
  difficulty: number;
  /** Solo en easy/medium: pista con forma de la palabra ("l___ u_"). */
  hint: string | null;
  /** Solo en easy/medium: numero de caracteres esperados. */
  length: number | null;
}

export interface Quiz {
  attemptId: number;
  mode: QuizMode;
  level: QuizLevel;
  passages: QuizPassage[];
  blanks: QuizBlank[];
  /** Solo en easy: banco de palabras mezclado (respuestas + distractores). */
  wordBank: string[] | null;
}

export interface BlankResult {
  candidateId: number;
  verdict: 'correct' | 'typo' | 'wrong' | 'skipped';
  userAnswer: string;
  expected: string;
  tag: CandidateTag;
  reason: string | null;
}

export interface AttemptResult {
  attemptId: number;
  total: number;
  correct: number;
  results: BlankResult[];
  /** Palabras falladas que entraron por primera vez al mazo de flashcards. */
  cardsAdded: number;
  /** Palabras falladas que ya estaban en el mazo: recayeron y se reinician. */
  cardsRelapsed: number;
}
