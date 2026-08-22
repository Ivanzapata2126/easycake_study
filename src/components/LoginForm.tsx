'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type FormState } from '@/app/actions';

export default function LoginForm() {
  const [state, formAction] = useActionState(loginAction, {} as FormState);

  return (
    <form action={formAction} className="card p-6 space-y-4">
      <div>
        <label className="label" htmlFor="username">Usuario</label>
        <input
          id="username" name="username" required autoFocus
          className="field" autoComplete="username" autoCapitalize="none"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">Contrasena</label>
        <input
          id="password" name="password" type="password" required
          className="field" autoComplete="current-password"
        />
      </div>

      {state.error && (
        <p className="text-sm text-bad-400 border border-bad-400/30 bg-bad-600/10 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? 'Entrando...' : 'Entrar'}
    </button>
  );
}
