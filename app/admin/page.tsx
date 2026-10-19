import { Suspense } from 'react';
import { requireAdmin } from '@/lib/auth/dal';
import { AppHeader } from '@/app/ui/app-header';

// Master admin (Mario / EMRG ops). The page shell loads instantly; the part that
// reads the login cookie streams in behind <Suspense>, as Cache Components requires.
export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-6">
      <Suspense fallback={<p className="text-dim">Loading…</p>}>
        <AdminHome />
      </Suspense>
    </div>
  );
}

async function AdminHome() {
  const user = await requireAdmin();
  return (
    <>
      <AppHeader title="Beehive Reviews" subtitle="Master admin, EMRG Media" userName={user.name} />
      <main className="rounded-xl border border-border bg-surface p-5 text-dim">
        Clients, alerts and contacts go here (Step 5).
      </main>
    </>
  );
}
