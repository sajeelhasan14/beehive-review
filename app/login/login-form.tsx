'use client';

import { useActionState } from 'react';
import { login } from './actions';

// Browser side of the form: shows the error and "Signing in…" while the server checks.
export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="grid gap-3">
      <input
        name="email"
        type="email"
        required
        autoComplete="username"
        placeholder="Email"
        defaultValue={state?.email}
        className="w-full rounded-lg border border-border bg-surface2 p-3 text-text placeholder:text-dim"
      />
      <input
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="Password"
        className="w-full rounded-lg border border-border bg-surface2 p-3 text-text placeholder:text-dim"
      />
      {state?.error && (
        <p role="alert" className="text-[13px] text-alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-text p-3 font-semibold text-bg disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
