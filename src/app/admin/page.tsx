import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { listUsers } from '@/lib/users';
import { listScripts } from '@/lib/scripts';
import CreateUserForm from '@/components/CreateUserForm';
import UserRow from '@/components/UserRow';
import { togglePublicAction } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const me = await requireAdmin();
  const [users, scripts] = await Promise.all([listUsers(), listScripts(me)]);
  const publicos = scripts.filter((s) => s.is_public);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administracion</h1>
        <p className="text-ink-400 text-sm mt-1">
          Usuarios y material publico. Cada usuario tiene sus propios scripts,
          intentos, estadisticas y flashcards.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Usuarios ({users.length})</h2>
        <ul className="space-y-2">
          {users.map((u) => (
            <UserRow key={u.id} user={u} isMe={u.id === me.id} />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Crear usuario</h2>
        <CreateUserForm />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Scripts publicos ({publicos.length})</h2>
          <Link href="/scripts/new" className="text-sm text-ink-400 hover:text-ink-100">
            crear uno nuevo
          </Link>
        </div>
        <p className="text-sm text-ink-400">
          Un script publico lo ve y lo practica todo el mundo, pero solo tu puedes
          editarlo. El progreso de cada persona sobre el es independiente.
        </p>
        <ul className="space-y-2">
          {scripts.map((s) => (
            <li key={s.id} className="card p-3 flex items-center gap-3 flex-wrap">
              <Link href={`/scripts/${s.id}`} className="min-w-0 flex-1 hover:text-brand-400">
                <span className="truncate">{s.title}</span>
                <span className="text-xs text-ink-400 ml-2">
                  {s.owner_username} · {s.candidate_count} huecos
                </span>
              </Link>
              {s.is_public && <span className="chip text-ok-400 border-ok-400/30">publico</span>}
              <form action={togglePublicAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="is_public" value={String(!s.is_public)} />
                <button type="submit" className="btn btn-ghost text-xs px-2.5 py-1.5">
                  {s.is_public ? 'Despublicar' : 'Publicar'}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
