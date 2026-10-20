import { connection } from 'next/server';
import { db } from '@/lib/db';

// GET /api/health -> 200 when the app can reach Postgres. Railway checks this before switching traffic to a new deploy.
export async function GET() {
  await connection(); // always answer at request time, never from the build
  try {
    await db().query('select 1');
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: 'database unreachable' }, { status: 503 });
  }
}
