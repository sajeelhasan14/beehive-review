import 'server-only';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/dal';

// Everything the master admin screen reads. Every function checks requireAdmin() first,
// so this data can't leak even if a page forgets its own check.

export type Vertical = 'hospitality' | 'dental';

export interface ClientCard {
  id: string;
  slug: string;
  name: string;
  vertical: Vertical;
  tier: 1 | 2 | 3;
  dashboard_enabled: boolean;
  status: 'active' | 'paused';
  funnel_id: string | null;
  funnel_slug: string | null;
  funnel_status: 'draft' | 'live' | 'paused' | null;
  contacts: number;
  reviews: number;       // happy submissions = customers sent to the review link
  open_alerts: number;   // unhappy submissions not yet resolved
  logins: string | null; // emails of this client's active logins
}

export interface AdminStats {
  contacts: number;
  submissions: number;
  avg_rating: number | null;
  happy: number;
  unhappy: number;
  clients: number;
}

export async function getClientCards(vertical: Vertical | null): Promise<ClientCard[]> {
  await requireAdmin();
  const { rows } = await db().query<ClientCard>(
    `select c.id, c.slug, c.name, c.vertical, c.tier, c.dashboard_enabled, c.status,
            f.id as funnel_id, f.slug as funnel_slug, f.status as funnel_status,
            (select count(*) from contacts ct where ct.client_id = c.id)::int as contacts,
            (select count(*) from submissions s where s.client_id = c.id and s.path = 'happy')::int as reviews,
            (select count(*) from submissions s
              where s.client_id = c.id and s.path = 'unhappy' and s.resolved_at is null)::int as open_alerts,
            (select string_agg(u.email, ', ' order by u.created_at) from users u
              where u.client_id = c.id and u.disabled_at is null) as logins
       from clients c
       left join lateral (
         select id, slug, status from funnels where client_id = c.id order by created_at limit 1
       ) f on true
      where c.status <> 'cancelled' and ($1::text is null or c.vertical = $1)
      order by c.created_at`,
    [vertical],
  );
  return rows;
}

export async function getAdminStats(): Promise<AdminStats> {
  await requireAdmin();
  const { rows } = await db().query<AdminStats>(
    `select (select count(*) from contacts)::int as contacts,
            count(*)::int as submissions,
            round(avg(rating), 1)::float8 as avg_rating,
            count(*) filter (where path = 'happy')::int as happy,
            count(*) filter (where path = 'unhappy')::int as unhappy,
            (select count(*) from clients where status <> 'cancelled')::int as clients
       from submissions`,
  );
  return rows[0];
}
