import { after } from 'next/server';
import { db } from '@/lib/db';
import { getLiveFunnel } from '@/lib/funnel/load';
import { renderFunnel } from '@/lib/funnel/render';

// GET /c/kyma-review -> Kyma's funnel page (the URL on the QR code).
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const funnel = await getLiveFunnel(slug);

  // Count the scan for the client dashboard, after the page is sent. Link previews and crawlers don't count.
  if (funnel && !/bot|crawl|spider|preview|slurp|facebookexternalhit|headless/i.test(request.headers.get('user-agent') ?? '')) {
    after(() =>
      db()
        .query('insert into funnel_scans (funnel_id, client_id) select id, client_id from funnels where slug = $1', [slug])
        .catch((err) => console.error('Could not count scan:', err)),
    );
  }

  return new Response(renderFunnel(funnel), {
    status: funnel ? 200 : 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
