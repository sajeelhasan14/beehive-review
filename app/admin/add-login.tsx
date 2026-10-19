'use client';

import { useActionState, useState } from 'react';
import { createClientLogin, type NewLoginResult } from './actions';

const input = 'w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-text placeholder:text-dim';
const button = 'rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:border-dim';

// "+ Add login" on a client card: creates a login for this client and shows the password once.
export function AddLogin({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createClientLogin.bind(null, clientId), undefined);

  if (state && 'login' in state) return <PasswordOnce login={state.login} />;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${button} mt-2`}>
        + Add login
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 grid gap-2">
      <input name="name" required placeholder="Their name" className={input} />
      <input name="email" type="email" required placeholder="Their email" className={input} />
      {state && 'error' in state && <p className="text-xs text-alert">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={`${button} disabled:opacity-60`}>
          {pending ? 'Creating…' : 'Create login'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={button}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// The generated password. Only its hash is stored, so this is the one chance to copy it.
export function PasswordOnce({ login }: { login: NewLoginResult }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 rounded-lg border border-ok bg-surface p-3 text-xs">
      <p className="font-semibold text-ok">Login created. Copy the password now, it is shown once.</p>
      <p className="mt-1.5 text-dim">
        Email: <span className="text-text">{login.email}</span>
      </p>
      <p className="text-dim">
        Password: <span className="font-mono text-text">{login.password}</span>
      </p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(`Email: ${login.email}\nPassword: ${login.password}`);
          setCopied(true);
        }}
        className={`${button} mt-2`}
      >
        {copied ? 'Copied' : 'Copy email and password'}
      </button>
    </div>
  );
}
