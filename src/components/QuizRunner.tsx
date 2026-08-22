'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { addCardAction, submitQuizAction } from '@/app/actions';
import { TAG_LABEL, VERDICT_LABEL } from '@/lib/labels';
import type { AttemptResult, Quiz } from '@/lib/types';

interface Props {
  quiz: Quiz;
  onRestart: () => void;
}

export default function QuizRunner({ quiz, onRestart }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const verdicts = useMemo(() => {
    if (!result) return null;
    return new Map(result.results.map((r) => [r.candidateId, r]));
  }, [result]);

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

  /** Enter salta al siguiente hueco en vez de enviar el formulario. */
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = inputs.current[index + 1];
    if (next) next.focus();
    else if (!result) void submit();
  }

  return (
    <div className="space-y-5">
      {result && <ScoreCard result={result} onRestart={onRestart} />}

      {!result && quiz.wordBank && (
        <div className="card p-4">
          <div className="label">Banco de palabras</div>
          <div className="flex flex-wrap gap-2 mt-1">
            {quiz.wordBank.map((w) => (
              <span key={w} className="chip font-read text-sm">{w}</span>
            ))}
          </div>
        </div>
      )}

      {quiz.passages.map((p, pi) => (
        <section key={`${p.scriptId}-${pi}`} className="card p-6">
          {quiz.mode === 'general' && (
            <div className="label mb-3 border-b border-ink-800 pb-2">{p.scriptTitle}</div>
          )}
          <div className="reader space-y-3">
            {p.lines.map((line) => (
              <p key={line.lineId} className={line.speaker ? 'grid grid-cols-[6rem_1fr] gap-3 items-baseline' : ''}>
                {line.speaker && <span className="speaker text-right">{line.speaker}</span>}
                <span>
                  {line.segments.map((seg, si) => {
                    if (seg.type === 'text') return <span key={si}>{seg.value}</span>;

                    const bi = seg.blankIndex!;
                    const blank = quiz.blanks[bi];
                    const key = String(blank.candidateId);
                    const v = verdicts?.get(blank.candidateId);
                    const width = blank.length === null ? 10 : Math.max(5, blank.length + 2);

                    return (
                      <span key={si} className="whitespace-nowrap">
                        <input
                          ref={(el) => { inputs.current[bi] = el; }}
                          className={[
                            'blank-input',
                            answers[key]?.trim() && !v ? 'filled' : '',
                            v ? `v-${v.verdict}` : '',
                          ].join(' ')}
                          style={{ width: `${width}ch` }}
                          value={answers[key] ?? ''}
                          onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
                          onKeyDown={(e) => onKeyDown(e, bi)}
                          placeholder={blank.hint ?? ''}
                          readOnly={!!result}
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          aria-label={`hueco ${bi + 1}`}
                        />
                        {v && v.verdict !== 'correct' && (
                          <span className="solution">{v.expected}</span>
                        )}
                      </span>
                    );
                  })}
                </span>
              </p>
            ))}
          </div>
        </section>
      ))}

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
            {filled} de {quiz.blanks.length} completados
          </span>
        </div>
      ) : (
        <Breakdown result={result} onRestart={onRestart} />
      )}
    </div>
  );
}

function ScoreCard({ result, onRestart }: { result: AttemptResult; onRestart: () => void }) {
  const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  const tone = pct >= 80 ? 'text-ok-400' : pct >= 50 ? 'text-warn-400' : 'text-bad-400';
  const toDeck = result.cardsAdded + result.cardsRelapsed;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-6 flex-wrap">
        <div>
          <div className={`text-4xl font-bold tabular-nums ${tone}`}>{pct}%</div>
          <div className="text-sm text-ink-400 mt-1">
            {result.correct} de {result.total} huecos
          </div>
        </div>
        <p className="text-sm text-ink-300 max-w-sm">
          Lo que fallaste sube de prioridad: volvera a aparecer antes en los proximos examenes.
        </p>
        <button onClick={onRestart} className="btn btn-primary ml-auto">Otro examen</button>
      </div>

      {toDeck > 0 && (
        <div className="border-t border-ink-800 pt-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-ink-300">
            {result.cardsAdded > 0 && (
              <>
                <strong className="text-brand-400">{result.cardsAdded}</strong>
                {result.cardsAdded === 1 ? ' palabra nueva' : ' palabras nuevas'}
              </>
            )}
            {result.cardsAdded > 0 && result.cardsRelapsed > 0 && ' y '}
            {result.cardsRelapsed > 0 && (
              <>
                <strong className="text-bad-400">{result.cardsRelapsed}</strong>
                {result.cardsRelapsed === 1 ? ' recaida' : ' recaidas'}
              </>
            )}
            {' en tus flashcards.'}
          </span>
          <Link href="/flashcards" className="btn btn-ghost ml-auto">Repasarlas ahora</Link>
        </div>
      )}
    </div>
  );
}

function Breakdown({ result, onRestart }: { result: AttemptResult; onRestart: () => void }) {
  const failed = result.results.filter((r) => r.verdict === 'wrong' || r.verdict === 'skipped');
  const typos = result.results.filter((r) => r.verdict === 'typo');

  return (
    <div className="space-y-4">
      {typos.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-warn-400 mb-2">Casi — revisa la escritura</h3>
          <ul className="space-y-1.5 text-sm">
            {typos.map((r) => (
              <li key={r.candidateId} className="flex items-center gap-2">
                <span className="text-ink-400 line-through">{r.userAnswer}</span>
                <span className="text-ink-600">&rarr;</span>
                <span className="font-read text-ok-400 text-base">{r.expected}</span>
                <AddToDeck candidateId={r.candidateId} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-bad-400 mb-3">Para repasar</h3>
          <ul className="space-y-2.5 text-sm">
            {failed.map((r) => (
              <li key={r.candidateId} className="flex items-start gap-3">
                <span className="font-read text-base text-ink-100 min-w-32">{r.expected}</span>
                <span className="chip shrink-0">{TAG_LABEL[r.tag] ?? r.tag}</span>
                <span className="text-ink-400">
                  {r.verdict === 'skipped'
                    ? VERDICT_LABEL.skipped
                    : <>escribiste <span className="text-bad-400">{r.userAnswer}</span></>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={onRestart} className="btn btn-ghost">Otro examen</button>
    </div>
  );
}

/**
 * Los typos no van solos al mazo: sabias la palabra, solo la tecleaste mal.
 * Pero si la ortografia es lo que te cuesta, la agregas de a una.
 */
function AddToDeck({ candidateId }: { candidateId: number }) {
  const [added, setAdded] = useState(false);
  if (added) return <span className="text-xs text-ok-400 ml-auto">en el mazo</span>;
  return (
    <button
      onClick={() => { setAdded(true); void addCardAction(candidateId); }}
      className="text-xs text-ink-400 hover:text-brand-400 ml-auto shrink-0"
    >
      + flashcard
    </button>
  );
}
