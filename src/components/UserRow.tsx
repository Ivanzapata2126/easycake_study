'use client';

import { useState } from 'react';
import {
  deleteUserAction, setActiveAction, setPasswordAction, setRoleAction,
} from '@/app/actions';
import type { UserWithCounts } from '@/lib/users';

export default function UserRow({ user: u, isMe }: { user: UserWithCounts; isMe: boolean }) {
  const [showPass, setShowPass] = useState(false);

  return (
    <li className={`card p-4 ${u.active ? '' : 'opacity-50'}`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{u.username}</span>
            {u.name && <span className="text-ink-400 text-sm">{u.name}</span>}
            {u.role === 'admin' && (
              <span className="chip text-brand-400 border-brand-500/40">admin</span>
            )}
            {isMe && <span className="chip">tu</span>}
            {!u.active && <span className="chip text-bad-400 border-bad-400/30">inactivo</span>}
          </div>
          <div className="text-xs text-ink-400 mt-1.5 tabular-nums">
            {u.scripts} scripts · {u.attempts} examenes · {u.cards} flashcards
            {u.last_seen && ` · ultimo acceso ${new Date(u.last_seen).toLocaleDateString('es')}`}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => setShowPass((v) => !v)}
            className="btn btn-ghost text-xs px-2.5 py-1.5"
          >
            Contrasena
          </button>

          <form action={setRoleAction}>
            <input type="hidden" name="id" value={u.id} />
            <input type="hidden" name="role" value={u.role === 'admin' ? 'user' : 'admin'} />
            <button type="submit" className="btn btn-ghost text-xs px-2.5 py-1.5" disabled={isMe}>
              {u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
            </button>
          </form>

          <form action={setActiveAction}>
            <input type="hidden" name="id" value={u.id} />
            <input type="hidden" name="active" value={String(!u.active)} />
            <button type="submit" className="btn btn-ghost text-xs px-2.5 py-1.5" disabled={isMe}>
              {u.active ? 'Desactivar' : 'Activar'}
            </button>
          </form>

          <form action={deleteUserAction}>
            <input type="hidden" name="id" value={u.id} />
            <button type="submit" className="btn btn-danger text-xs px-2.5 py-1.5" disabled={isMe}>
              Borrar
            </button>
          </form>
        </div>
      </div>

      {showPass && (
        <form action={setPasswordAction} className="mt-3 pt-3 border-t border-ink-800 flex gap-2">
          <input type="hidden" name="id" value={u.id} />
          <input
            name="password" type="text" required minLength={6}
            className="field flex-1" placeholder="Nueva contrasena (minimo 6)"
          />
          <button type="submit" className="btn btn-primary text-xs px-3">Cambiar</button>
        </form>
      )}
      {showPass && (
        <p className="text-xs text-ink-400 mt-2">
          Cambiar la contrasena cierra todas las sesiones abiertas de {isMe ? 'tu cuenta' : u.username}.
        </p>
      )}
    </li>
  );
}
