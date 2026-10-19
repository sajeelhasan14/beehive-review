import { db } from '@/lib/db';

// POST /api/public/submit  <- every funnel page sends its form here.
// Public URL, so nothing in the body is trusted until checked below.
// Example body: { slug: 'kyma-review', rating: 5, path: 'happy', first_name: 'Erica', phone: '9175550101', ... }

// Trimmed text, cut to max length. Empty or not a string -> null.
function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().slice(0, max);
  return t || null;
}

// Whole number between min and max (also accepts "10" from a <select>). Otherwise null.
function whole(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  return value !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// Digits only, US leading 1 removed: "+1 (917) 555-0101" -> "9175550101".
function phoneDigits(value: unknown): string {
  const d = typeof value === 'string' ? value.replace(/\D/g, '').slice(0, 15) : '';
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}

function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'Body must be JSON');
  }
  if (!body || typeof body !== 'object') return fail(400, 'Body must be a JSON object');

  const slug = text(body.slug, 80);
  const rating = whole(body.rating, 1, 5);
  const path = body.path === 'happy' || body.path === 'unhappy' ? body.path : null;
  const phone = phoneDigits(body.phone);
  const email = text(body.email, 120);

  if (!slug || !rating || !path) return fail(400, 'slug, rating and path are required');
  if (path === 'happy' && phone.length !== 10) return fail(400, 'A 10 digit phone number is required');

  try {
    // $1..$11 are filled from the array below. pg sends them separately from the SQL,
    // so nothing a customer types can change the query (no SQL injection).
    const { rows } = await db().query<{ result: { returning_visitor: boolean; first_name: string | null } }>(
      `select public.record_submission($1, $2::smallint, $3, $4, $5, $6, $7, $8::smallint, $9::smallint, $10, $11) as result`,
      [
        slug,
        rating,
        path,
        text(body.first_name, 60),
        text(body.last_name, 60),
        phone || null,
        email && email.includes('@') ? email : null,
        whole(body.birthday_month, 1, 12),
        whole(body.birthday_day, 1, 31),
        body.sms_consent === true,
        text(body.feedback_text, 1000),
      ],
    );
    // result = { returning_visitor, first_name } from the database function.
    return Response.json({ ok: true, path, ...rows[0].result });
  } catch (err) {
    if ((err as { code?: string }).code === 'P0002') return fail(404, 'Funnel not found');
    console.error('record_submission failed:', err);
    return fail(500, 'Could not save');
  }
}
