import Link from 'next/link';
import { loadSamplesAction } from '@/app/actions';
import { listScripts } from '@/lib/scripts';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ScriptsPage() {
  const user = await requireUser();
  const scripts = await listScripts(user);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scripts y dialogos</h1>
          <p className="text-ink-400 text-sm mt-1">{scripts.length} guardados</p>
        </div>
        <Link href="/scripts/new" className="btn btn-primary">Nuevo script</Link>
      </div>

      {scripts.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-ink-300">Aun no has guardado ningun script.</p>
          <p className="text-ink-400 text-sm mt-2">
            Pega un dialogo y la app se encarga de decidir que palabras tapar.
          </p>
          {user.role === 'admin' && (
            <form action={loadSamplesAction} className="mt-4">
              <button type="submit" className="btn btn-ghost">
                Cargar 3 dialogos de ejemplo
              </button>
            </form>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {scripts.map((s) => (
            <li key={s.id}>
              <Link href={`/scripts/${s.id}`} className="card p-4 block hover:border-ink-600 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{s.title}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-ink-400">
                      {s.level && <span className="chip">{s.level}</span>}
                      {s.topic && <span className="chip">{s.topic}</span>}
                      {s.speakers.map((sp) => <span key={sp} className="chip">{sp}</span>)}
                      {s.is_public && (
                        <span className="chip text-ok-400 border-ok-400/30">publico</span>
                      )}
                      {!s.is_owner && (
                        <span className="chip">de {s.owner_username}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-ink-400 shrink-0 tabular-nums">
                    <div>{s.line_count} lineas</div>
                    <div className="text-brand-400 font-semibold mt-0.5">{s.candidate_count} huecos</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
