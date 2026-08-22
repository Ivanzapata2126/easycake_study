'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { createUserAction, type FormState } from '@/app/actions';

export default function CreateUserForm() {
  const [state, formAction] = useActionState(createUserAction, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await formAction(fd);
        ref.current?.reset();
      }}
      className="card p-5 space-y-4"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="username">Usuario</label>
          <input id="username" name="username" required className="field"
            placeholder="juan" autoCapitalize="none" />
        </div>
        <div>
          <label className="label" htmlFor="name">Nombre</label>
          <input id="name" name="name" className="field" placeholder="Juan Perez" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contrasena</label>
          <input id="password" name="password" type="text" required minLength={6}
            className="field" placeholder="minimo 6 caracteres" />
        </div>
        <div>
          <label className="label" htmlFor="role">Rol</label>
          <select id="role" name="role" className="field" defaultValue="user">
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-bad-400 border border-bad-400/30 bg-bad-600/10 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="text-sm text-ok-400 border border-ok-400/30 bg-ok-600/10 rounded-lg px-3 py-2">
          {state.ok}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Creando...' : 'Crear usuario'}
    </button>
  );
}
