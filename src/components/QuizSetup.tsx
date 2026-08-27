'use client';

import { useState } from 'react';
import { startQuizAction } from '@/app/actions';
import { LEVEL_HELP } from '@/lib/labels';
import type { Quiz, QuizConfig, QuizFormat, QuizLevel, QuizMode } from '@/lib/types';
import QuizRunner from './QuizRunner';
import SentenceRunner from './SentenceRunner';

interface ScriptOption {
  id: number;
  title: string;
  candidate_count: number;
  translated_count: number;
  speakers: string[];
}

interface Props {
  scripts: ScriptOption[];
  initialScriptId?: number;
  initialSpeaker?: string;
}

const LEVELS: QuizLevel[] = ['easy', 'medium', 'hard'];
const LEVEL_NAME: Record<QuizLevel, string> = { easy: 'Facil', medium: 'Medio', hard: 'Dificil' };
const DENSITIES = [
  { value: 0.1, label: '10%', help: 'suave' },
  { value: 0.2, label: '20%', help: 'estandar' },
  { value: 0.3, label: '30%', help: 'exigente' },
];

export default function QuizSetup({ scripts, initialScriptId, initialSpeaker }: Props) {
  const [mode, setMode] = useState<QuizMode>(
    initialSpeaker ? 'speaker' : initialScriptId ? 'script' : 'general',
  );
  const [scriptId, setScriptId] = useState<number | undefined>(initialScriptId ?? scripts[0]?.id);
  const [speaker, setSpeaker] = useState<string | undefined>(initialSpeaker);
  const [format, setFormat] = useState<QuizFormat>('gaps');
  const [level, setLevel] = useState<QuizLevel>('medium');
  const [density, setDensity] = useState(0.2);
  const [passages, setPassages] = useState(4);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = scripts.find((s) => s.id === scriptId);
  const speakers = selected?.speakers ?? [];

  // El formato de frase completa necesita traducciones: en modo general basta
  // con que exista alguna, en modo script tiene que tenerlas ese script.
  const sinTraduccion = mode === 'general'
    ? scripts.every((s) => s.translated_count === 0)
    : (selected?.translated_count ?? 0) === 0;

  // Se DERIVA en vez de corregir el estado: si cambias a un script sin
  // traducciones, el formato vuelve a huecos solo, sin un setState durante el
  // render (que ademas dejaria elegido "frase completa" al volver atras).
  const formato: QuizFormat = sinTraduccion ? 'gaps' : format;

  async function start() {
    setLoading(true);
    setError(null);
    const config: QuizConfig = {
      mode,
      format: formato,
      scriptId: mode === 'general' ? undefined : scriptId,
      speaker: mode === 'speaker' ? (speaker ?? speakers[0]) : undefined,
      level,
      density,
      maxBlanks: 40,
      passages: mode === 'general' ? passages : undefined,
    };
    const res = await startQuizAction(config);
    setLoading(false);
    if (res.error) setError(res.error);
    else if (res.quiz) setQuiz(res.quiz);
  }

  if (quiz) {
    return quiz.format === 'sentence'
      ? <SentenceRunner quiz={quiz} onRestart={() => setQuiz(null)} />
      : <QuizRunner quiz={quiz} onRestart={() => setQuiz(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-5">
        <div>
          <div className="label">Formato</div>
          <div className="grid sm:grid-cols-2 gap-2">
            <Choice active={formato === 'gaps'} onClick={() => setFormat('gaps')}
              title="Frase con huecos" desc="Rellenas las palabras que faltan" />
            <Choice
              active={formato === 'sentence'}
              onClick={() => setFormat('sentence')}
              title="Frase completa"
              desc={sinTraduccion
                ? 'Necesita traducciones al espanol'
                : 'Ves el espanol y escribes todo el ingles'}
              disabled={sinTraduccion}
            />
          </div>
          {formato === 'sentence' && (
            <p className="text-xs text-ink-400 mt-2">
              Se corrige palabra por palabra: veras exactamente cuales fallaste.
            </p>
          )}
        </div>

        <div>
          <div className="label">Que quieres practicar</div>
          <div className="grid sm:grid-cols-3 gap-2">
            <Choice active={mode === 'general'} onClick={() => setMode('general')}
              title="Mezcla general" desc="Pasajes de varios scripts" />
            <Choice active={mode === 'script'} onClick={() => setMode('script')}
              title="Un script" desc="Todo el dialogo completo" />
            <Choice
              active={mode === 'speaker'}
              onClick={() => setMode('speaker')}
              title="Un solo rol"
              desc="Completas los turnos de un hablante"
              disabled={speakers.length < 2}
            />
          </div>
        </div>

        {mode !== 'general' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="script">Script</label>
              <select
                id="script" className="field" value={scriptId ?? ''}
                onChange={(e) => { setScriptId(Number(e.target.value)); setSpeaker(undefined); }}
              >
                {scripts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.candidate_count} huecos)
                  </option>
                ))}
              </select>
            </div>
            {mode === 'speaker' && (
              <div>
                <label className="label" htmlFor="speaker">Tu rol</label>
                <select
                  id="speaker" className="field" value={speaker ?? speakers[0] ?? ''}
                  onChange={(e) => setSpeaker(e.target.value)}
                >
                  {speakers.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {mode === 'general' && (
          <div>
            <label className="label" htmlFor="passages">Pasajes a mezclar: {passages}</label>
            <input
              id="passages" type="range" min={2} max={8} value={passages}
              onChange={(e) => setPassages(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
            <p className="text-xs text-ink-400 mt-1">
              Cada pasaje son 4-8 turnos seguidos de un script distinto. Se mezcla el material
              sin romper el contexto de la conversacion.
            </p>
          </div>
        )}

        <div className={formato === 'sentence' ? 'hidden' : ''}>
          <div className="label">Dificultad</div>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <Choice key={l} active={level === l} onClick={() => setLevel(l)}
                title={LEVEL_NAME[l]} desc={LEVEL_HELP[l]} />
            ))}
          </div>
        </div>

        <div className={formato === 'sentence' ? 'hidden' : ''}>
          <div className="label">Densidad de huecos</div>
          <div className="grid grid-cols-3 gap-2">
            {DENSITIES.map((d) => (
              <Choice key={d.value} active={density === d.value} onClick={() => setDensity(d.value)}
                title={d.label} desc={d.help} />
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-bad-400 border border-bad-400/30 bg-bad-600/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button onClick={start} className="btn btn-primary" disabled={loading || !scripts.length}>
        {loading ? 'Armando examen...' : 'Empezar'}
      </button>
    </div>
  );
}

function Choice({
  active, onClick, title, desc, disabled,
}: {
  active: boolean; onClick: () => void; title: string; desc: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'text-left rounded-xl border px-3 py-2.5 transition-colors',
        active ? 'border-brand-500 bg-brand-500/10' : 'border-ink-700 hover:border-ink-600',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <div className={`text-sm font-semibold ${active ? 'text-brand-400' : 'text-ink-100'}`}>{title}</div>
      <div className="text-xs text-ink-400 mt-0.5">{desc}</div>
    </button>
  );
}
