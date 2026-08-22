'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { parseScript, speakersOf } from '@/lib/parse';
import type { FormState } from '@/app/actions';

const PLACEHOLDER = `Man: Hey, did you manage to sort out the tickets?
Woman: Not yet. I've been trying to get through to them all morning.
Man: Although the website says they're open until six.
Woman: I know. I'll give it another go after lunch.`;

interface Props {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: {
    id?: number;
    title: string;
    topic: string;
    level: string;
    source: string;
    notes: string;
    raw: string;
    isPublic?: boolean;
  };
  submitLabel: string;
  /** Solo un admin puede publicar un script para todos los usuarios. */
  isAdmin?: boolean;
}

const EMPTY = { title: '', topic: '', level: '', source: '', notes: '', raw: '' };

export default function ScriptForm({ action, initial, submitLabel, isAdmin }: Props) {
  const start = initial ?? EMPTY;
  const [state, formAction] = useActionState(action, {} as FormState);
  const [raw, setRaw] = useState(start.raw);

  // Preview en vivo del parseo: ves como quedan los turnos antes de guardar.
  const preview = useMemo(() => {
    const lines = parseScript(raw);
    return { lines, speakers: speakersOf(lines) };
  }, [raw]);

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">Titulo</label>
            <input id="title" name="title" defaultValue={start.title} required
              className="field" placeholder="Unit 4 - Making arrangements" />
          </div>
          <div>
            <label className="label" htmlFor="topic">Tema</label>
            <input id="topic" name="topic" defaultValue={start.topic}
              className="field" placeholder="Telefono, trabajo, viajes..." />
          </div>
          <div>
            <label className="label" htmlFor="level">Nivel</label>
            <select id="level" name="level" defaultValue={start.level} className="field">
              <option value="">Sin definir</option>
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="source">Fuente</label>
            <input id="source" name="source" defaultValue={start.source}
              className="field" placeholder="Libro, clase, podcast..." />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <label className="label" htmlFor="raw">Texto del script</label>
        <p className="text-xs text-ink-400 mb-2">
          Un turno por linea, con <code className="text-brand-400">Hablante:</code> al inicio.
          Las lineas sin dos puntos se guardan como narracion.
        </p>
        <textarea
          id="raw" name="raw" required rows={14}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="field font-mono text-sm leading-relaxed"
          placeholder={PLACEHOLDER}
        />
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-ink-400">
          <span>{preview.lines.length} lineas</span>
          {preview.speakers.length > 0 && (
            <>
              <span>·</span>
              <span>hablantes:</span>
              {preview.speakers.map((s) => <span key={s} className="chip">{s}</span>)}
            </>
          )}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label" htmlFor="notes">Notas</label>
          <textarea id="notes" name="notes" defaultValue={start.notes} rows={2}
            className="field" placeholder="Lo que quieras recordar de este script" />
        </div>

        {isAdmin && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox" name="is_public" defaultChecked={initial?.isPublic ?? false}
              className="mt-1 accent-brand-500 w-4 h-4"
            />
            <span className="text-sm">
              Publicar para todos
              <span className="block text-xs text-ink-400 mt-0.5">
                Todos los usuarios podran practicarlo, pero solo tu editarlo.
                El progreso de cada quien es independiente.
              </span>
            </span>
          </label>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-bad-400 border border-bad-400/30 bg-bad-600/10 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <Submit label={submitLabel} />
        <Link href={initial?.id ? `/scripts/${initial.id}` : '/scripts'} className="btn btn-ghost">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Analizando...' : label}
    </button>
  );
}
