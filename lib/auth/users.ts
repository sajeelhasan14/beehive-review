import 'server-only';
import { randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { hashPassword } from '@/lib/auth/password';

export interface NewLogin {
  email: string;
  name: string;
  role: 'admin' | 'client';
  clientId: string | null;
}

// Creates a login with a generated password and returns that password.
// It is shown to the admin once and never stored (only its hash is).
// Accepts a pool or a transaction client, so it can run inside "create client".
export async function createLogin(q: Pool | PoolClient, login: NewLogin): Promise<string> {
  const password = randomBytes(12).toString('base64url'); // 16 random characters
  await q.query(
    'insert into users (email, name, password_hash, role, client_id) values ($1, $2, $3, $4, $5)',
    [login.email, login.name, await hashPassword(password), login.role, login.clientId],
  );
  return password;
}
