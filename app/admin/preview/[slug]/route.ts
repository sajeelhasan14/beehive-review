import { getCurrentUser } from '@/lib/auth/dal';
import { getFunnelForPreview } from '@/lib/funnel/load';
import { renderFunnel } from '@/lib/funnel/render';

// GET /admin/preview/figlia-sons-review -> the funnel even while it's a draft. Admins only.
// A preview sends nothing and never redirects to Google (getFunnelForPreview sets preview: true).
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') return new Response('Not found', { status: 404 });

  const { slug } = await params;
  const funnel = await getFunnelForPreview(slug);

  return new Response(renderFunnel(funnel), {
    status: funnel ? 200 : 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
