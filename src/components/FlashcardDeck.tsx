'use client';

import { useState } from 'react';
import Link from 'next/link';
import { removeCardAction, toggleSuspendAction } from '@/app/actions';
import { TAG_LABEL } from '@/lib/labels';
import { formatInterval } from '@/lib/srs';
import type { Flashcard } from '@/lib/flashcards';

type DeckCard = Flashcard & { due: string; suspended: boolean };

/** Vista de gestion: ver todo el mazo, pausar lo que ya te sabes, borrar lo que sobra. */
export default function FlashcardDeck({ cards }: { cards: DeckCard[] }) {
  const [tag, setTag] = useState<string | null>(null);
  const tags = [...new Set(cards.map((c) => c.tag))];
  const shown = tag ? cards.filter((c) => c.tag === tag) : cards;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTag(null)} className={`chip ${tag === null ? 'border-brand-500 text-brand-400' : ''}`}>
          todas ({cards.length})
        </button>
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => setTag(tag === t ? null : t)}
            className={`chip ${tag === t ? 'border-brand-500 text-brand-400' : ''}`}
          >
            {TAG_LABEL[t] ?? t} ({cards.filter((c) => c.tag === t).length})
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {shown.map((c) => {
          const due = new Date(c.due);
          const overdue = due.getTime() <= Date.now();
          return (
            <li key={c.id} className={`card p-4 ${c.suspended ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="reader text-[1rem]">
                    <span className="text-ink-400">{c.before}</span>
                    <mark className="bg-brand-500/20 text-brand-400 rounded px-1">{c.answer}</mark>
                    <span className="text-ink-400">{c.after}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-ink-400">
                    <span className="chip">{TAG_LABEL[c.tag] ?? c.tag}</span>
                    <Link href={`/scripts/${c.scriptId}`} className="hover:text-ink-100 truncate">
                      {c.scriptTitle}
                    </Link>
                    <span>·</span>
                    <span className={overdue && !c.suspended ? 'text-brand-400' : ''}>
                      {c.suspended
                        ? 'pausada'
                        : overdue
                          ? 'pendiente'
                          : `en ${formatInterval(c.intervalDays)}`}
                    </span>
                    {c.lapses > 0 && <span className="text-bad-400">{c.lapses} caidas</span>}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <form action={toggleSuspendAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="suspended" value={String(!c.suspended)} />
                    <button type="submit" className="btn btn-ghost text-xs px-2.5 py-1.5">
                      {c.suspended ? 'Reanudar' : 'Ya me la se'}
                    </button>
                  </form>
                  <form action={removeCardAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="btn btn-danger text-xs px-2.5 py-1.5">
                      Quitar
                    </button>
                  </form>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
