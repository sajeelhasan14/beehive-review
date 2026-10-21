'use client';

import { useOptimistic, useTransition } from 'react';
import { setDashboardLook, type DashboardLook } from '@/app/admin/actions';

// Admins only: the strip above a client's dashboard that sets its look. Saves on every tap,
// and the client sees the same thing next time they open their dashboard.
export function LookBar({ clientId, look: saved }: { clientId: string; look: DashboardLook }) {
  const [pending, startTransition] = useTransition();
  // The switch moves at once; the page behind it changes when the save comes back.
  const [look, setLook] = useOptimistic(saved);
  const save = (change: Partial<DashboardLook>) =>
    startTransition(async () => {
      setLook({ ...look, ...change });
      await setDashboardLook(clientId, { ...look, ...change });
    });

  return (
    <div
      className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-dashed border-border px-4 py-3 text-[13px]"
    >
      <span className="text-xs text-dim">Admin only, the client never sees this bar</span>
      <Segments
        label="Theme"
        value={look.theme}
        onChange={(theme) => save({ theme })}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
      <Segments
        label="Layout"
        value={look.style}
        onChange={(style) => save({ style })}
        options={[
          { value: 'classic', label: 'Classic' },
          { value: 'spotlight', label: 'Spotlight' },
          { value: 'tiles', label: 'Tiles' },
        ]}
      />
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" checked={look.sample} onChange={(e) => save({ sample: e.target.checked })} />
        Sample data
      </label>
      {pending && <span className="text-xs text-dim">Saving…</span>}
    </div>
  );
}

function Segments<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-dim">{label}</span>
      <div className="flex rounded-lg border border-border bg-surface p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => value !== o.value && onChange(o.value)}
            className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${value === o.value ? 'bg-text text-bg' : 'text-dim hover:text-text'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
