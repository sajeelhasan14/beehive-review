import { Suspense } from 'react';
import { requireAdmin } from '@/lib/auth/dal';
import { getAdminStats, getClientCards, type Vertical } from '@/lib/data/admin';
import { AppHeader } from '@/app/ui/app-header';
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

  const [clients, stats] = await Promise.all([getClientCards(vertical), getAdminStats()]);
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
              <ClientCard key={c.id} client={c} />
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
