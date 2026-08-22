import Link from 'next/link';
import { loadSamplesAction } from '@/app/actions';
import { dashboardStats, recentAttempts } from '@/lib/quiz';
import { deckStats } from '@/lib/flashcards';
import { listScripts } from '@/lib/scripts';
import { requireUser } from '@/lib/auth';
import { TAG_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await requireUser();
  const [stats, attempts, scripts, deck] = await Promise.all([
    dashboardStats(user.id),
    recentAttempts(user.id, 6),
    listScripts(user),
    deckStats(user.id),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Hola, {user.name || user.username}</h1>
        <p className="text-ink-400 text-sm mt-1">
          Cada examen reordena la prioridad: lo que fallas vuelve a salir antes.
        </p>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Scripts" value={stats.scripts} />
        <Stat label="Huecos posibles" value={stats.candidates} />
        <Stat label="Examenes hechos" value={stats.attempts} />
        <Stat
          label="Acierto global"
          value={stats.accuracy === null ? '--' : `${Math.round(stats.accuracy * 100)}%`}
          accent={stats.accuracy !== null && stats.accuracy >= 0.8}
        />
      </section>

      {stats.scripts === 0 && (
        <section className="card p-8 text-center">
          <p className="text-ink-300">Todavia no hay scripts.</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Link href="/scripts/new" className="btn btn-primary">Agregar el primero</Link>
            {user.role === 'admin' && (
              <form action={loadSamplesAction}>
                <button type="submit" className="btn btn-ghost">Cargar ejemplos</button>
              </form>
            )}
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Lo que mas fallas</h2>
            {deck.total > 0 && (
              <Link href="/flashcards" className="text-xs text-ink-400 hover:text-brand-400">
                {deck.due > 0 ? `repasar ${deck.due}` : `mazo (${deck.total})`}
              </Link>
            )}
          </div>
          {stats.weakest.length === 0 ? (
            <p className="text-sm text-ink-400">Nada registrado todavia. Haz un examen.</p>
          ) : (
            <ul className="space-y-2">
              {stats.weakest.map((w, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="font-read text-brand-400 text-base">{w.answer}</span>
                  <span className="chip">{TAG_LABEL[w.tag] ?? w.tag}</span>
                  <span className="ml-auto text-ink-400 tabular-nums">
                    {w.wrong}/{w.seen} fallos
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-3">Por categoria</h2>
          {stats.byTag.length === 0 ? (
            <p className="text-sm text-ink-400">Sin datos aun.</p>
          ) : (
            <ul className="space-y-3">
              {stats.byTag.map((t) => {
                const rate = t.seen ? t.wrong / t.seen : 0;
                return (
                  <li key={t.tag}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{TAG_LABEL[t.tag] ?? t.tag}</span>
                      <span className="text-ink-400 tabular-nums">
                        {Math.round((1 - rate) * 100)}% acierto
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-ok-400"
                        style={{ width: `${Math.round((1 - rate) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {attempts.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Ultimos examenes</h2>
          <ul className="divide-y divide-ink-800">
            {attempts.map((a) => (
              <li key={a.id} className="py-2.5 flex items-center gap-3 text-sm">
                <span className="chip">{a.mode === 'general' ? 'mezcla' : a.mode}</span>
                <span className="text-ink-300 truncate">{a.title ?? 'Varios scripts'}</span>
                <span className="ml-auto tabular-nums text-ink-400">
                  {a.correct}/{a.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {scripts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Tus scripts</h2>
            <Link href="/scripts" className="text-sm text-ink-400 hover:text-ink-100">
              ver todos
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {scripts.slice(0, 4).map((s) => (
              <Link key={s.id} href={`/scripts/${s.id}`} className="card p-4 hover:border-ink-600 transition-colors">
                <div className="font-medium truncate">{s.title}</div>
                <div className="text-xs text-ink-400 mt-1">
                  {s.line_count} lineas · {s.candidate_count} huecos
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-ink-400 font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${accent ? 'text-ok-400' : ''}`}>
        {value}
      </div>
    </div>
  );
}
