import 'server-only';
import { Pool } from 'pg';

// One shared pool of Postgres connections (Railway) for the whole app.
// Kept on globalThis so `next dev` reloads reuse it instead of opening a new pool on every save.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export function db(): Pool {
  if (!globalForDb.pgPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('Missing DATABASE_URL. Copy .env.example to .env.local and paste the Railway Postgres URL.');
    }
    globalForDb.pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return globalForDb.pgPool;
}
