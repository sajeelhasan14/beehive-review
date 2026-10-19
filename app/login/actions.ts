'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { dummyHash, verifyPassword } from '@/lib/auth/password';
import { createSession, deleteSession } from '@/lib/auth/session';

export type LoginState = { error: string; email: string } | undefined;

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;

// Runs on the server when the login form is submitted.
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  const password = String(formData.get('password') ?? '').slice(0, 200);
  if (!email || !password) return { error: 'Enter your email and password.', email };

  // Block password guessing: too many recent failures for this email -> stop here.
  const { rows: [recent] } = await db().query<{ failures: number }>(
    `select count(*)::int as failures from login_attempts
      where email = $1 and not success and created_at > now() - make_interval(mins => $2)`,
    [email, WINDOW_MINUTES],
  );
  if (recent.failures >= MAX_FAILURES) {
    return { error: `Too many failed attempts. Try again in ${WINDOW_MINUTES} minutes.`, email };
  }

  const { rows: [user] } = await db().query<{ id: string; password_hash: string; role: 'admin' | 'client'; client_slug: string | null }>(
    `select u.id, u.password_hash, u.role, c.slug as client_slug
       from users u left join clients c on c.id = u.client_id
      where u.email = $1 and u.disabled_at is null`,
    [email],
  );

  // Always run a full password check, even for unknown emails (same timing either way).
  const correct = await verifyPassword(password, user?.password_hash ?? (await dummyHash()));
  const success = Boolean(user) && correct;
  await db().query('insert into login_attempts (email, success) values ($1, $2)', [email, success]);

  // Same message for wrong email and wrong password, so nobody learns which emails exist.
  if (!success) return { error: 'Wrong email or password.', email };

  await createSession(user.id);
  redirect(user.role === 'admin' ? '/admin' : `/d/${user.client_slug}`);
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect('/login');
}
