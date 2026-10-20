import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { SESSION_COOKIE, hashToken } from '@/lib/auth/session';

// Data Access Layer: the ONE place that decides who is signed in and what they may see.
// Every protected page and every dashboard query goes through these functions.

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'client';
  clientId: string | null;
  clientSlug: string | null;
}

export interface ClientSummary {
  id: string;
  slug: string;
  name: string;
  vertical: 'hospitality' | 'dental';
  tier: 1 | 2 | 3;
  dashboard_enabled: boolean;
  brand_color: string;
  upgrade_requested_at: Date | null;
}

// Reads the session cookie and returns the user, or null. cache() = one database read per request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { rows } = await db().query<CurrentUser>(
    `select u.id, u.email, u.name, u.role, u.client_id as "clientId", c.slug as "clientSlug"
       from sessions s
       join users u on u.id = s.user_id
       left join clients c on c.id = u.client_id
      where s.id = $1 and s.expires_at > now() and u.disabled_at is null`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
});

// Signed in, any role. Otherwise -> /login.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

// Mario / EMRG ops only. A client opening /admin gets "not found".
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== 'admin') notFound();
  return user;
}

// The client behind /d/{slug}, if this user may see it: admins see any client,
// a client user only their own. Anything else is "not found", so nobody learns which slugs exist.
export async function requireClientAccess(slug: string): Promise<{ user: CurrentUser; client: ClientSummary }> {
  const user = await requireUser();
  const client = await findClientFor(user, slug);
  if (!client) notFound();
  return { user, client };
}

// Same rule for Route Handlers (CSV download), which answer with a status instead of redirecting.
export async function getClientAccess(slug: string): Promise<{ user: CurrentUser; client: ClientSummary } | null> {
  const user = await getCurrentUser();
  const client = user && (await findClientFor(user, slug));
  return user && client ? { user, client } : null;
}

async function findClientFor(user: CurrentUser, slug: string): Promise<ClientSummary | null> {
  const { rows } = await db().query<ClientSummary>(
    `select id, slug, name, vertical, tier, dashboard_enabled, brand_color, upgrade_requested_at
       from clients where slug = $1 and status <> 'cancelled'`,
    [slug],
  );
  const client = rows[0];
  if (!client || (user.role !== 'admin' && user.clientId !== client.id)) return null;
  return client;
}
