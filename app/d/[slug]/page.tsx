import { Suspense } from 'react';
import { requireClientAccess } from '@/lib/auth/dal';
import { AppHeader } from '@/app/ui/app-header';

// Client dashboard: /d/kyma. Only Kyma's own logins (and admins) get past requireClientAccess.
export default function ClientDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-20 pt-6">
      <Suspense fallback={<p className="text-dim">Loading…</p>}>
        <Dashboard params={params} />
      </Suspense>
    </div>
  );
}

async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, client } = await requireClientAccess(slug);
  const vertical = client.vertical === 'dental' ? 'Dental' : 'Hospitality';

  return (
    <>
      <AppHeader title={client.name} subtitle={`Beehive Reviews · Tier ${client.tier} · ${vertical}`} userName={user.name} />
      <main className="rounded-xl border border-border bg-surface p-5 text-dim">
        Money view, automations and guest list go here (Step 6).
      </main>
    </>
  );
}
