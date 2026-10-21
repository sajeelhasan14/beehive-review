import 'server-only';
import { headers } from 'next/headers';
import { baseUrl } from '@/lib/base-url';
import { db } from '@/lib/db';
import { qrPng, stickerSheetPdf, tableTentPdf } from '@/lib/kit/print-kit';

// The print kit for one client's funnel: qr.png | table-tent.pdf | stickers.pdf.
// Callers (the admin route and the client dashboard route) decide who may ask; this only builds the file.
export const KIT_FILES = {
  'qr.png': 'image/png',
  'table-tent.pdf': 'application/pdf',
  'stickers.pdf': 'application/pdf',
} as const;

export async function kitResponse(slug: string, file: string): Promise<Response> {
  if (!(file in KIT_FILES)) return new Response('Not found', { status: 404 });

  const { rows: [funnel] } = await db().query<{ funnel_slug: string; name: string; question: string | null; color: string }>(
    `select f.slug as funnel_slug, c.name, f.rating_question as question, c.brand_color as color
       from clients c join funnels f on f.client_id = c.id
      where c.slug = $1 order by f.created_at limit 1`,
    [slug],
  );
  if (!funnel) return new Response('Not found', { status: 404 });

  const kit = {
    url: `${baseUrl(await headers())}/c/${funnel.funnel_slug}`,
    name: funnel.name,
    question: funnel.question || 'How was your visit?',
    color: funnel.color,
  };
  const body =
    file === 'qr.png' ? await qrPng(kit.url) : file === 'table-tent.pdf' ? await tableTentPdf(kit) : await stickerSheetPdf(kit);

  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': KIT_FILES[file as keyof typeof KIT_FILES],
      'Content-Disposition': `inline; filename="${slug}-${file}"`,
      'Cache-Control': 'no-store',
    },
  });
}
