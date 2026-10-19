import { Suspense, type ReactNode } from 'react';
import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/auth/dal';
import { getAdminStats, getClientCards, getOpenAlerts, getRecentContacts, type Vertical } from '@/lib/data/admin';
import { baseUrl } from '@/lib/base-url';
import { sheetsEnabled } from '@/lib/sheets';
import { AppHeader } from '@/app/ui/app-header';
import { resolveAlert } from '@/app/d/[slug]/actions';
import { AddClient } from './add-client';
import { ClientCard } from './client-card';

// Master admin (Mario / EMRG ops). The page shell loads instantly; the part that
// reads the login cookie streams in behind <Suspense>, as Cache Components requires.
export default function AdminPage({ searchParams }: { searchParams: Promise<{ vertical?: string }> }) {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-6">
      <Suspense fallback={<p className="text-dim">Loading…</p>}>
        <AdminHome searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const FILTERS: { label: string; value: Vertical | null }[] = [
  { label: 'All verticals', value: null },
  { label: 'Hospitality', value: 'hospitality' },
  { label: 'Dental', value: 'dental' },
];

async function AdminHome({ searchParams }: { searchParams: Promise<{ vertical?: string }> }) {
  const user = await requireAdmin();
  const { vertical: raw } = await searchParams;
  const vertical: Vertical | null = raw === 'hospitality' || raw === 'dental' ? raw : null;

  const [clients, stats, alerts, contacts] = await Promise.all([
    getClientCards(vertical),
    getAdminStats(),
    getOpenAlerts(),
    getRecentContacts(),
  ]);
  const base = baseUrl(await headers());
  const sheets = sheetsEnabled();
  const happyPct = stats.submissions ? `${Math.round((stats.happy / stats.submissions) * 100)}%` : '—';

  return (
    <>
      <AppHeader title="Beehive Reviews" subtitle="Master admin, EMRG Media" userName={user.name} />

      <section className="mb-[18px] rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="text-[15px] font-semibold">
            Clients<span className="ml-2 text-[13px] font-normal text-dim">{stats.clients}</span>
          </h2>
          <nav className="flex gap-1.5">
            {FILTERS.map((f) => (
              <a
                key={f.label}
                href={f.value ? `/admin?vertical=${f.value}` : '/admin'}
                className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                  f.value === vertical ? 'border-text bg-text font-semibold text-bg' : 'border-border bg-surface2 text-text'
                }`}
              >
                {f.label}
              </a>
            ))}
          </nav>
        </div>

        <AddClient />

        {clients.length ? (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[repeat(auto-fill,minmax(330px,1fr))]">
            {clients.map((c) => (
              <ClientCard key={c.id} client={c} baseUrl={base} sheets={sheets} />
            ))}
          </div>
        ) : (
          <p className="py-[18px] text-center text-dim">No clients in this vertical yet.</p>
        )}
      </section>

      <section className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        <Stat label="Contacts" value={stats.contacts} />
        <Stat label="Avg rating" value={stats.avg_rating ?? '—'} />
        <Stat label="Happy %" value={happyPct} />
        <Stat label="Sent to review" value={stats.happy} />
        <Stat label="Unhappy" value={stats.unhappy} />
        <Stat label="Clients" value={stats.clients} />
      </section>

      <Panel title="Unhappy alerts" badge={alerts.length} open={alerts.length > 0}>
        {alerts.length ? (
          <div className="grid gap-2.5">
            {alerts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface2 p-3">
                <div>
                  <b>{a.first_name || 'Anonymous'}</b> <span className="text-brand">{stars(a.rating)}</span>
                  <div className="text-xs text-dim">
                    {a.client_name} · {a.phone || 'no phone'} · {date(a.created_at)}
                  </div>
                  {a.feedback_text && <p className="mt-1 text-[13px]">“{a.feedback_text}”</p>}
                </div>
                <form action={resolveAlert.bind(null, a.id)}>
                  <button type="submit" className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:border-dim">
                    Mark resolved
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-3 text-center text-dim">Nothing needs follow up.</p>
        )}
      </Panel>

      <Panel title="All contacts" badge={null}>
        {contacts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr>
                  {['Name', 'Phone', 'Rating', 'Visits', 'Client', 'Last seen'].map((h) => (
                    <th key={h} className="border-b border-border px-2 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-dim">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="border-b border-border px-2 py-2">{c.first_name}</td>
                    <td className="border-b border-border px-2 py-2">{c.phone}</td>
                    <td className="border-b border-border px-2 py-2 text-brand">{stars(c.last_rating)}</td>
                    <td className="border-b border-border px-2 py-2">{c.visits}</td>
                    <td className="border-b border-border px-2 py-2">{c.client_name}</td>
                    <td className="border-b border-border px-2 py-2">{date(c.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-3 text-center text-dim">No contacts yet.</p>
        )}
      </Panel>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <div className="text-xs text-dim">{label}</div>
      <div className="mt-0.5 text-[26px] font-bold text-metric">{value}</div>
    </div>
  );
}

const stars = (n: number | null) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '');
const date = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

// Fold-open panel (the demo's .panel), no JavaScript needed.
function Panel({ title, badge, open, children }: { title: string; badge: number | null; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group mt-3 overflow-hidden rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between px-5 py-3.5">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold">
          {title}
          {badge ? <span className="rounded-full bg-alert px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span> : null}
        </h2>
        <span className="text-dim transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-border px-5 pb-5 pt-3">{children}</div>
    </details>
  );
}
