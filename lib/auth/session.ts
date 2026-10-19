import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export const SESSION_COOKIE = 'bh_session';
const SESSION_DAYS = 30;

// The database stores only this hash of the cookie code, never the code itself.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Called after a correct password: saves a session row and gives the browser its cookie.
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db().query('insert into sessions (id, user_id, expires_at) values ($1, $2, $3)', [
    hashToken(token),
    userId,
    expiresAt,
  ]);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,                                  // page JavaScript can't read it
    secure: process.env.NODE_ENV === 'production',   // https only when live
    sameSite: 'lax',                                 // not sent on cross site form posts
    path: '/',
    expires: expiresAt,
  });
}

// Log out: remove the session row (so the code is dead even if copied) and the cookie.
export async function deleteSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db().query('delete from sessions where id = $1', [hashToken(token)]);
  store.delete(SESSION_COOKIE);
}
