'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { toggleCandidateAction } from '@/app/actions';
import { TAG_LABEL } from '@/lib/labels';
import type { CandidateRow, LineRow } from '@/lib/types';

interface Props {
  scriptId: number;
  lines: LineRow[];
  candidates: CandidateRow[];
  /** Un lector de un script publico ve los huecos pero no cura material ajeno. */
  editable: boolean;
}

const TAG_COLOR: Record<string, string> = {
  phrasal_verb: 'text-brand-400 decoration-brand-600',
  preposition: 'text-ok-400 decoration-ok-600',
  connector: 'text-[#c084fc] decoration-[#7e3ff2]',
  verb_form: 'text-[#5fc3e4] decoration-[#2680c2]',
  modal: 'text-[#f0a3b1] decoration-[#8c2f39]',
  contraction: 'text-ink-300 decoration-ink-600',
  vocab: 'text-[#9fb3c8] decoration-ink-600',
};

/**
 * Vista de lectura con los candidatos subrayados. Cada uno se puede apagar con
 * un click: con un analizador heuristico siempre habra algun hueco que no vale
 * la pena, y curarlos a mano es mas rapido que afinar las listas.
 */
export default function ScriptReader({ scriptId, lines, candidates, editable }: Props) {
  const [filter, setFilter] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    candidates,
    (state: CandidateRow[], upd: { id: number; enabled: boolean }) =>
      state.map((c) => (c.id === upd.id ? { ...c, enabled: upd.enabled } : c)),
  );

  const byLine = new Map<number, CandidateRow[]>();
  for (const c of optimistic) {
    const list = byLine.get(c.line_id) ?? [];
    list.push(c);
    byLine.set(c.line_id, list);
  }

  const tags = [...new Set(optimistic.map((c) => c.tag))];
  const counts = Object.fromEntries(
    tags.map((t) => [t, optimistic.filter((c) => c.tag === t && c.enabled).length]),
  );

  function toggle(c: CandidateRow) {
    if (!editable) return;
    startTransition(async () => {
      setOptimistic({ id: c.id, enabled: !c.enabled });
      await toggleCandidateAction(c.id, !c.enabled, scriptId);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter(null)}
          className={`chip ${filter === null ? 'border-brand-500 text-brand-400' : ''}`}
        >
          todas ({optimistic.filter((c) => c.enabled).length})
        </button>
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(filter === t ? null : t)}
            className={`chip ${filter === t ? 'border-brand-500 text-brand-400' : ''}`}
          >
            {TAG_LABEL[t] ?? t} ({counts[t]})
          </button>
        ))}
      </div>

      <div className="card p-6 reader space-y-3">
        {lines.map((line) => {
          const onLine = (byLine.get(line.id) ?? [])
            .filter((c) => !filter || c.tag === filter)
            .sort((a, b) => a.start_pos - b.start_pos);

          const parts: React.ReactNode[] = [];
          let cursor = 0;
          for (const c of onLine) {
            if (c.start_pos > cursor) {
              parts.push(<span key={`t${cursor}`}>{line.text.slice(cursor, c.start_pos)}</span>);
            }
            parts.push(
              <button
                key={`c${c.id}`}
                onClick={() => toggle(c)}
                disabled={!editable}
                title={`${TAG_LABEL[c.tag] ?? c.tag} · dificultad ${c.difficulty}${c.reason ? ` · ${c.reason}` : ''}`}
                className={[
                  c.enabled
                    ? `underline underline-offset-4 decoration-2 ${TAG_COLOR[c.tag] ?? ''}`
                    : 'text-ink-600 line-through',
                  editable ? 'cursor-pointer' : 'cursor-default',
                ].join(' ')}
              >
                {line.text.slice(c.start_pos, c.end_pos)}
              </button>,
            );
            cursor = c.end_pos;
          }
          if (cursor < line.text.length) {
            parts.push(<span key="tail">{line.text.slice(cursor)}</span>);
          }

          return (
            <p key={line.id} className={line.speaker ? 'grid grid-cols-[6rem_1fr] gap-3 items-baseline' : ''}>
              {line.speaker && <span className="speaker text-right">{line.speaker}</span>}
              <span>{parts}</span>
            </p>
          );
        })}
      </div>

      <p className="text-xs text-ink-400">
        {editable
          ? 'Click en una palabra subrayada para descartarla como hueco. Pasa el mouse por encima para ver por que la eligio el analizador.'
          : 'Este script es de otra persona: puedes practicarlo, pero no editar sus huecos.'}
      </p>
    </div>
  );
}
