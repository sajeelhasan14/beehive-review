'use client';

import { useActionState } from 'react';
import { login } from './actions';

const input =
  'w-full rounded-[10px] border border-border bg-surface px-3.5 py-3 text-[15px] text-text placeholder:text-dim focus:border-text';

// Browser side of the form: shows the error and "Signing in…" while the server checks.
export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="grid gap-3.5">
      <label className="grid gap-1.5 text-[13px] font-medium">
        Email
        <input name="email" type="email" required autoComplete="username" defaultValue={state?.email} className={input} />
      </label>
      <label className="grid gap-1.5 text-[13px] font-medium">
        Password
        <input name="password" type="password" required autoComplete="current-password" className={input} />
      </label>
      {state?.error && (
        <p role="alert" className="text-[13px] text-alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded-xl bg-text px-4 py-3.5 text-[15px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
