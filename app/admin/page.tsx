import { Suspense, type ReactNode } from 'react';
import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/auth/dal';
import { getAdminStats, getClientCards, getOpenAlerts, getRecentContacts, type Vertical } from '@/lib/data/admin';
import { baseUrl } from '@/lib/base-url';
import { sheetsEnabled } from '@/lib/sheets';
import { AppHeader } from '@/app/ui/app-header';
import { resolveAlert } from '@/app/d/[slug]/actions';
import { AddClient, AddClientProvider, AddClientSlot } from './add-client';
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
  { label: 'All clients', value: null },
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
      <AppHeader
        title="All clients"
        subtitle="Funnels, logins and unhappy customers for every Beehive account."
        userName={user.name}
      />

      <section className="mb-10 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-surface sm:grid-cols-3 lg:grid-cols-6">
        <Figure label="Clients" value={stats.clients} />
        <Figure label="Contacts captured" value={stats.contacts} />
        <Figure label="Sent to Google" value={stats.happy} />
        <Figure label="Happy" value={happyPct} />
        <Figure label="Average rating" value={stats.avg_rating ?? '—'} />
        <Figure label="Unhappy caught" value={stats.unhappy} alert={alerts.length > 0} />
      </section>

      <AddClientProvider>
        <section className="mb-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border">
            <nav className="-mb-px flex gap-6" aria-label="Filter by vertical">
              {FILTERS.map((f) => (
                <a
                  key={f.label}
                  href={f.value ? `/admin?vertical=${f.value}` : '/admin'}
                  aria-current={f.value === vertical ? 'page' : undefined}
                  className={`border-b-2 pb-3 text-[13px] ${
                    f.value === vertical ? 'border-brand font-semibold text-text' : 'border-transparent text-dim hover:text-text'
                  }`}
                >
                  {f.label}
                </a>
              ))}
            </nav>
            <div className="pb-2.5">
              <AddClient />
            </div>
          </div>

          <AddClientSlot />

          {clients.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
              {clients.map((c) => (
                <ClientCard key={c.id} client={c} baseUrl={base} sheets={sheets} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border py-10 text-center text-dim">
              No clients in this vertical yet. Use Add client to set one up.
            </p>
          )}
        </section>
      </AddClientProvider>

      <Panel title="Unhappy customers to follow up" count={alerts.length} open={alerts.length > 0}>
        {alerts.length ? (
          <ul className="divide-y divide-border">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-1">
                <div>
                  <span className="font-medium">{a.first_name || 'Anonymous'}</span>{' '}
                  <span className="ml-1 text-brand" aria-label={`${a.rating} out of 5`}>
                    {stars(a.rating)}
                  </span>
                  <div className="mt-0.5 text-xs text-dim">
                    {a.client_name}, {phone(a.phone) || 'no phone left'}, {date(a.created_at)}
                  </div>
                  {a.feedback_text && (
                    <p className="mt-1.5 max-w-[65ch] font-serif text-[14px] leading-relaxed">“{a.feedback_text}”</p>
                  )}
                </div>
                <form action={resolveAlert.bind(null, a.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-dim"
                  >
                    Mark resolved
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-dim">Nobody is waiting on a call back.</p>
        )}
      </Panel>

      <Panel title="Latest contacts" count={null}>
        {contacts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr>
                  {['Name', 'Phone', 'Rating', 'Visits', 'Client', 'Last seen'].map((h) => (
                    <th key={h} className="border-b border-border px-2 pb-2.5 text-xs font-medium text-dim">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="border-b border-border px-2 py-2.5">{c.first_name}</td>
                    <td className="border-b border-border px-2 py-2.5 tabular-nums">{phone(c.phone)}</td>
                    <td className="border-b border-border px-2 py-2.5 text-brand">{stars(c.last_rating)}</td>
                    <td className="border-b border-border px-2 py-2.5 tabular-nums">{c.visits}</td>
                    <td className="border-b border-border px-2 py-2.5">{c.client_name}</td>
                    <td className="border-b border-border px-2 py-2.5 tabular-nums">{date(c.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-2 text-dim">No contacts yet. They appear here as soon as a QR code is scanned.</p>
        )}
      </Panel>
    </>
  );
}

// One cell of the portfolio band: serif figure over a quiet label, hairline between cells.
function Figure({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="-ml-px -mt-px border-l border-t border-border px-5 py-5">
      <div className={`figure text-[30px] font-bold leading-none ${alert ? 'text-alert' : ''}`}>{value}</div>
      <div className="mt-2 text-xs text-dim">{label}</div>
    </div>
  );
}

const stars = (n: number | null) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '');
const phone = (p: string | null) => (p && p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : (p ?? ''));
const date = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

// Fold-open panel (the demo's .panel), no JavaScript needed.
function Panel({ title, count, open, children }: { title: string; count: number | null; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group mb-4 rounded-2xl border border-border bg-surface">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-3 rounded-2xl px-6 py-4">
        <h2 className="flex items-center gap-3 font-serif text-[17px] font-bold">
          {title}
          {count ? (
            <span className="rounded-full bg-alert px-2 py-0.5 font-sans text-[11px] font-semibold text-white">{count}</span>
          ) : null}
        </h2>
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-dim transition-transform group-open:rotate-180">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="px-6 pb-5">{children}</div>
    </details>
  );
}
