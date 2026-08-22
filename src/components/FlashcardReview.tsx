'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { reviewCardAction } from '@/app/actions';
import { grade as gradeAnswer } from '@/lib/grading';
import { GRADES, formatInterval, schedule, type Grade } from '@/lib/srs';
import { TAG_LABEL } from '@/lib/labels';
import type { Flashcard } from '@/lib/flashcards';

interface Props {
  initial: Flashcard[];
}

const TONE: Record<string, string> = {
  bad: 'border-bad-400/40 text-bad-400 hover:bg-bad-600/15',
  warn: 'border-warn-400/40 text-warn-400 hover:bg-warn-400/10',
  ok: 'border-ok-400/40 text-ok-400 hover:bg-ok-600/15',
};

export default function FlashcardReview({ initial }: Props) {
  const [queue, setQueue] = useState<Flashcard[]>(initial);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState('');
  const [doneCount, setDoneCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const card = queue[pos];
  const total = initial.length;

  // Si escribiste algo, la tarjeta se autocorrige con el mismo motor del examen
  // y deja sugerido el boton que corresponde. Un Enter mas y sigues.
  const auto = revealed && typed.trim()
    ? gradeAnswer(typed, card.answer, card.altAnswers).verdict
    : null;
  const suggested: Grade | null =
    auto === null ? null : auto === 'correct' ? 2 : auto === 'typo' ? 1 : 0;

  const reveal = useCallback(() => setRevealed(true), []);

  const answer = useCallback(
    async (g: Grade) => {
      const current = queue[pos];
      setRevealed(false);
      setTyped('');
      // "Otra vez" la devuelve al final de la sesion, como en cualquier SRS.
      if (g === 0) setQueue((q) => [...q, current]);
      else setDoneCount((n) => n + 1);
      setPos((p) => p + 1);
      await reviewCardAction(current.id, g, typed.trim() || null);
    },
    [queue, pos, typed],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, [pos]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!card) return;
      if (!revealed) {
        if (e.key === 'Enter') { e.preventDefault(); reveal(); }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        void answer(suggested ?? 2);
      } else if (e.key >= '1' && e.key <= '3') {
        e.preventDefault();
        void answer((Number(e.key) - 1) as Grade);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, revealed, suggested, answer, reveal]);

  if (!card) {
    return (
      <div className="card p-10 text-center space-y-4">
        <div className="text-4xl">✓</div>
        <p className="text-lg font-semibold">Mazo al dia</p>
        <p className="text-sm text-ink-400">
          {doneCount} {doneCount === 1 ? 'tarjeta repasada' : 'tarjetas repasadas'}.
          Las que fallaste vuelven a estar disponibles hoy mismo.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/quiz" className="btn btn-primary">Hacer un examen</Link>
          <Link href="/flashcards" className="btn btn-ghost">Ver el mazo</Link>
        </div>
      </div>
    );
  }

  const state = { ease: card.ease, interval: card.intervalDays, reps: card.reps };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-ink-400">
        <div className="h-1.5 flex-1 rounded-full bg-ink-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${Math.round((doneCount / Math.max(total, 1)) * 100)}%` }}
          />
        </div>
        <span className="tabular-nums shrink-0">
          {doneCount} / {total}
          {queue.length > total && ` (+${queue.length - total} repetidas)`}
        </span>
      </div>

      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-2 text-xs">
          <Link href={`/scripts/${card.scriptId}`} className="text-ink-400 hover:text-ink-100 truncate">
            {card.scriptTitle}
          </Link>
          <span className="chip shrink-0">{TAG_LABEL[card.tag] ?? card.tag}</span>
          {card.isNew && <span className="chip shrink-0 text-brand-400 border-brand-500/40">nueva</span>}
          {card.lapses > 0 && (
            <span className="chip shrink-0 text-bad-400 border-bad-400/30">
              {card.lapses} {card.lapses === 1 ? 'caida' : 'caidas'}
            </span>
          )}
        </div>

        {card.context && (
          <p className="reader text-ink-600 text-[0.95rem] leading-relaxed border-l-2 border-ink-800 pl-3">
            {card.contextSpeaker && <span className="speaker mr-2">{card.contextSpeaker}</span>}
            {card.context}
          </p>
        )}

        <p className="reader text-[1.2rem]">
          {card.speaker && <span className="speaker mr-3">{card.speaker}</span>}
          {card.before}
          {revealed ? (
            <mark className="bg-ok-600/25 text-ok-400 rounded px-1.5 py-0.5">{card.answer}</mark>
          ) : (
            <span className="inline-block align-baseline border-b-2 border-brand-500 w-24 mx-1" />
          )}
          {card.after}
        </p>

        {!revealed ? (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="field flex-1 font-read"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Escribe la palabra (opcional)"
              autoComplete="off" autoCorrect="off" spellCheck={false}
            />
            <button onClick={reveal} className="btn btn-primary">Mostrar</button>
          </div>
        ) : (
          <div className="space-y-4">
            {auto && (
              <p className="text-sm">
                {auto === 'correct' && <span className="text-ok-400">Correcto.</span>}
                {auto === 'typo' && (
                  <span className="text-warn-400">
                    Casi: escribiste <span className="line-through">{typed}</span>
                  </span>
                )}
                {auto === 'wrong' && (
                  <span className="text-bad-400">
                    Escribiste <span className="line-through">{typed}</span>
                  </span>
                )}
              </p>
            )}
            {card.reason && <p className="text-xs text-ink-400">{card.reason}</p>}

            <div className="grid grid-cols-3 gap-2">
              {GRADES.map((g, i) => {
                const next = schedule(g.value, state);
                return (
                  <button
                    key={g.value}
                    onClick={() => void answer(g.value)}
                    className={[
                      'rounded-xl border px-3 py-2.5 transition-colors text-center',
                      TONE[g.tone],
                      suggested === g.value ? 'ring-2 ring-brand-500/60' : '',
                    ].join(' ')}
                  >
                    <div className="text-sm font-semibold">{g.label}</div>
                    <div className="text-[0.68rem] text-ink-400 mt-0.5 tabular-nums">
                      {formatInterval(next.interval)} · tecla {i + 1}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-ink-400">
        {revealed
          ? 'Enter acepta la opcion sugerida. 1 / 2 / 3 califican directo.'
          : 'Enter muestra la respuesta. Escribir es opcional, pero se autocorrige si lo haces.'}
      </p>
    </div>
  );
}
