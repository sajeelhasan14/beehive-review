import { getLiveFunnel } from '@/lib/funnel/load';
import { renderFunnel } from '@/lib/funnel/render';

// GET /c/kyma-review -> Kyma's funnel page (the URL on the QR code).
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const funnel = await getLiveFunnel(slug);

  return new Response(renderFunnel(funnel), {
    status: funnel ? 200 : 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
