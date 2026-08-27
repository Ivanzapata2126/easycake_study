'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { reviewVocabAction, suspendVocabAction } from '@/app/actions';
import { GRADES, formatInterval, schedule, type Grade } from '@/lib/srs';
import { TAG_LABEL } from '@/lib/labels';
import type { VocabCard } from '@/lib/vocab';

const TONE: Record<string, string> = {
  bad: 'border-bad-400/40 text-bad-400 hover:bg-bad-600/15',
  warn: 'border-warn-400/40 text-warn-400 hover:bg-warn-400/10',
  ok: 'border-ok-400/40 text-ok-400 hover:bg-ok-600/15',
};

/**
 * Repaso de vocabulario: ingles delante, español detras. Es reconocer, no
 * producir — para producir estan las flashcards de fallos, que te piden la
 * palabra dentro de su frase.
 */
export default function VocabReview({
  cards, title, scriptId,
}: { cards: VocabCard[]; title: string; scriptId: number }) {
  const pendientes = cards.filter((c) => c.due && !c.suspended);
  const [queue, setQueue] = useState<VocabCard[]>(pendientes);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  const card = queue[pos];
  const total = pendientes.length;

  const answer = useCallback(async (g: Grade) => {
    const actual = queue[pos];
    setRevealed(false);
    if (g === 0) setQueue((q) => [...q, actual]);   // vuelve al final de la sesion
    else setDone((n) => n + 1);
    setPos((p) => p + 1);
    await reviewVocabAction(actual.word, g);
  }, [queue, pos]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!card) return;
      if (!revealed) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRevealed(true); }
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); void answer(2); }
      else if (e.key >= '1' && e.key <= '3') { e.preventDefault(); void answer((Number(e.key) - 1) as Grade); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, revealed, answer]);

  if (!total) {
    return (
      <div className="card p-10 text-center space-y-3">
        <div className="text-4xl">✓</div>
        <p className="font-semibold">Nada pendiente en {title}</p>
        <p className="text-sm text-ink-400">
          Ya repasaste las {cards.length} palabras de este script. Vuelve cuando toquen.
        </p>
        <Link href="/flashcards" className="btn btn-ghost mt-2">Volver a los mazos</Link>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="card p-10 text-center space-y-3">
        <div className="text-4xl">✓</div>
        <p className="text-lg font-semibold">Mazo terminado</p>
        <p className="text-sm text-ink-400">{done} palabras repasadas.</p>
        <Link href="/flashcards" className="btn btn-primary mt-2">Otro mazo</Link>
      </div>
    );
  }

  const state = { ease: card.ease, interval: card.intervalDays, reps: card.reps };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-ink-400">
        <div className="h-1.5 flex-1 rounded-full bg-ink-800 overflow-hidden">
          <div className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${Math.round((done / Math.max(total, 1)) * 100)}%` }} />
        </div>
        <span className="tabular-nums shrink-0">
          {done} / {total}{queue.length > total && ` (+${queue.length - total})`}
        </span>
      </div>

      <div className="card p-8 space-y-6 text-center">
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="chip">{TAG_LABEL[card.tag] ?? card.tag}</span>
          {card.isNew && <span className="chip text-brand-400 border-brand-500/40">nueva</span>}
          {card.lapses > 0 && (
            <span className="chip text-bad-400 border-bad-400/30">{card.lapses} caídas</span>
          )}
        </div>

        <p className="reader text-3xl text-ink-100">{card.word}</p>

        {revealed ? (
          <div className="space-y-2">
            <p className="reader text-2xl text-ok-400">{card.translation}</p>
            {card.note && <p className="text-sm text-ink-400">{card.note}</p>}
          </div>
        ) : (
          <button onClick={() => setRevealed(true)} className="btn btn-primary">
            Mostrar traducción
          </button>
        )}

        {revealed && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            {GRADES.map((g, i) => {
              const next = schedule(g.value, state);
              return (
                <button key={g.value} onClick={() => void answer(g.value)}
                  className={`rounded-xl border px-3 py-2.5 transition-colors ${TONE[g.tone]}`}>
                  <div className="text-sm font-semibold">{g.label}</div>
                  <div className="text-[0.68rem] text-ink-400 mt-0.5 tabular-nums">
                    {formatInterval(next.interval)} · tecla {i + 1}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <p className="text-xs text-ink-400 flex-1">
          {revealed ? 'Enter = Bien. 1 / 2 / 3 califican directo.' : 'Enter o espacio muestra la traducción.'}
        </p>
        <form action={suspendVocabAction}>
          <input type="hidden" name="word" value={card.word} />
          <input type="hidden" name="suspended" value="true" />
          <button type="submit" className="btn btn-ghost text-xs px-2.5 py-1.5">Ya me la sé</button>
        </form>
        <Link href={`/scripts/${scriptId}`} className="text-xs text-ink-400 hover:text-ink-100">
          ver el script
        </Link>
      </div>
    </div>
  );
}
