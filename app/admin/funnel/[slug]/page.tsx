import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/dal';
import { getFunnelForEditor } from '@/lib/funnel/load';
import { AppHeader, headerButton as button } from '@/app/ui/app-header';
import { FunnelEditor } from './funnel-editor';

// Page editor: /admin/funnel/kyma-review. Admins change the look and wording of the page
// customers see after scanning the QR code, with a live phone preview beside the settings.
export default function FunnelEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pb-28 pt-6">
      <Suspense fallback={<p className="text-dim">Loading…</p>}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireAdmin();
  const { slug } = await params;
  const funnel = await getFunnelForEditor(slug);
  if (!funnel) notFound();

  return (
    <>
      <AppHeader
        title={`${funnel.view.client_name} review page`}
        subtitle="What customers see when they scan the QR code. Every change shows in the preview right away."
        userName={user.name}
        mark={funnel.view.brand_primary}
      >
        <a href="/admin" className={button}>All clients</a>
        {funnel.status === 'live' && (
          <a href={`/c/${slug}`} target="_blank" rel="noreferrer" className={button}>Open live page</a>
        )}
      </AppHeader>
      <FunnelEditor funnelId={funnel.id} live={funnel.status === 'live'} view={funnel.view} />
    </>
  );
}
