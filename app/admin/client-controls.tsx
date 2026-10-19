'use client';

import { useTransition } from 'react';
import { setDashboard, setTier } from './actions';

// The two switches on each client card. They save the moment they change (no Save button),
// which needs browser code, so only this small part is a Client Component.
export function ClientControls({ clientId, tier, dashboard }: { clientId: string; tier: number; dashboard: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className={`mt-3 flex flex-wrap items-center gap-2.5 text-xs text-dim ${pending ? 'opacity-60' : ''}`}>
      <label className="flex items-center gap-1.5">
        Tier
        <select
          value={tier}
          disabled={pending}
          onChange={(e) => startTransition(() => setTier(clientId, Number(e.target.value)))}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
        >
          <option value={1}>1 Capture</option>
          <option value={2}>2 Command</option>
          <option value={3}>3 Revenue</option>
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={dashboard}
          disabled={pending}
          onChange={(e) => startTransition(() => setDashboard(clientId, e.target.checked))}
        />
        Dashboard on
      </label>
      {pending && <span>Saving…</span>}
    </div>
  );
}
