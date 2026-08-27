'use client';

import { useRef, useState } from 'react';
import { submitQuizAction } from '@/app/actions';
import type { AttemptResult, Quiz, SentenceResultRow } from '@/lib/types';
import type { WordDiff } from '@/lib/grading';

/**
 * Modo "frase completa": arriba el espanol, abajo escribes el ingles entero.
 * Al corregir no se da un veredicto seco por frase, se marca palabra por
 * palabra — en una frase de doce palabras, "incorrecto" a secas no ensena nada.
 */
export default function SentenceRunner({ quiz, onRestart }: { quiz: Quiz; onRestart: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const sentences = quiz.sentences ?? [];
  const byLine = new Map((result?.sentences ?? []).map((r) => [r.lineId, r]));
  const filled = Object.values(answers).filter((v) => v.trim()).length;

  async function submit() {
    setSending(true);
    setError(null);
    const res = await submitQuizAction(quiz.attemptId, answers);
    setSending(false);
    if (res.error) setError(res.error);
    else if (res.result) {
      setResult(res.result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = inputs.current[i + 1];
    if (next) next.focus();
    else if (!result) void submit();
  }

  return (
    <div className="space-y-4">
      {result && <Score result={result} onRestart={onRestart} />}

      {sentences.map((s, i) => {
        const key = String(s.lineId);
        const r = byLine.get(s.lineId);
        return (
          <div key={s.lineId} className="card p-5 space-y-3">
            <div className="flex items-baseline gap-3">
              <span className="text-xs text-ink-600 tabular-nums shrink-0">{i + 1}</span>
              <div className="min-w-0 flex-1">
                {s.speaker && <span className="speaker mr-2">{s.speaker}</span>}
                <span className="reader text-ink-300 text-[1.05rem]">{s.translation}</span>
                <span className="text-xs text-ink-600 ml-2">({s.words} palabras)</span>
              </div>
            </div>

            <input
              ref={(el) => { inputs.current[i] = el; }}
              className={[
                'field font-read text-[1.05rem]',
                r ? (r.verdict === 'correct' ? 'border-ok-400/60'
                  : r.verdict === 'typo' ? 'border-warn-400/60' : 'border-bad-400/60') : '',
              ].join(' ')}
              value={answers[key] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
              onKeyDown={(e) => onKeyDown(e, i)}
              placeholder="Escribe la frase en ingles"
              readOnly={!!result}
              autoComplete="off" autoCorrect="off" spellCheck={false}
              aria-label={`frase ${i + 1}`}
            />

            {r && <Correction row={r} />}
          </div>
        );
      })}

      {error && (
        <p className="text-sm text-bad-400 border border-bad-400/30 bg-bad-600/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {!result ? (
        <div className="flex items-center gap-4 sticky bottom-4">
          <button onClick={submit} className="btn btn-primary" disabled={sending}>
            {sending ? 'Corrigiendo...' : 'Corregir'}
          </button>
          <span className="text-sm text-ink-400 tabular-nums">
            {filled} de {sentences.length} escritas
          </span>
        </div>
      ) : (
        <button onClick={onRestart} className="btn btn-ghost">Otro examen</button>
      )}
    </div>
  );
}

function Correction({ row }: { row: SentenceResultRow }) {
  return (
    <div className="space-y-2 pt-1">
      <p className="reader text-[1.02rem] leading-loose">
        {row.diff.map((w, i) => <Word key={i} w={w} />)}
      </p>
      <div className="flex items-center gap-3 text-xs">
        <span className="tabular-nums text-ink-400">{row.matched}/{row.words} palabras</span>
        {row.verdict !== 'correct' && (
          <span className="text-ink-400">
            correcta: <span className="font-read text-ok-400 text-sm">{row.expected}</span>
          </span>
        )}
      </div>
    </div>
  );
}

const ESTILO: Record<WordDiff['status'], string> = {
  ok: 'text-ok-400',
  typo: 'text-warn-400 underline decoration-dotted underline-offset-4',
  wrong: 'text-bad-400 line-through',
  missing: 'text-bad-400 border-b-2 border-bad-400/50',
  extra: 'text-ink-600 line-through',
};

function Word({ w }: { w: WordDiff }) {
  return (
    <>
      <span className={ESTILO[w.status]} title={w.expected ? `esperado: ${w.expected}` : w.status}>
        {w.word}
      </span>
      {w.expected && w.status === 'wrong' && (
        <span className="text-ok-400"> ({w.expected})</span>
      )}
      {' '}
    </>
  );
}

function Score({ result, onRestart }: { result: AttemptResult; onRestart: () => void }) {
  const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  const palabras = result.sentences.reduce((a, s) => a + s.matched, 0);
  const totalPalabras = result.sentences.reduce((a, s) => a + s.words, 0);
  const tone = pct >= 80 ? 'text-ok-400' : pct >= 50 ? 'text-warn-400' : 'text-bad-400';

  return (
    <div className="card p-6 flex items-center gap-6 flex-wrap">
      <div>
        <div className={`text-4xl font-bold tabular-nums ${tone}`}>{pct}%</div>
        <div className="text-sm text-ink-400 mt-1">
          {result.correct} de {result.total} frases
        </div>
      </div>
      <div className="text-sm text-ink-300">
        <div className="tabular-nums">
          {palabras} de {totalPalabras} palabras correctas
        </div>
        <p className="text-ink-400 text-xs mt-1 max-w-xs">
          Este modo no alimenta las flashcards: aquellas van por hueco y aqui la
          unidad es la frase entera.
        </p>
      </div>
      <button onClick={onRestart} className="btn btn-primary ml-auto">Otro examen</button>
    </div>
  );
}
