import 'server-only';
import { db } from '@/lib/db';
import { requireClientAccess } from '@/lib/auth/dal';

// Everything the client dashboard (/d/{slug}) reads. Each query is scoped to one client_id,
// and getDashboard() runs requireClientAccess() first, so one client can never see another's rows.

// "This month" and "birthdays this month" follow the clients' clock (New York), not the server's.
const TZ = 'America/New_York';

export interface Guest {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  email: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  visits: number;
  sms_consent: boolean;
  first_seen_at: Date;
  last_seen_at: Date;
  last_rating: number | null;
  last_feedback: string | null;
}

export interface Alert {
  id: string;
  first_name: string | null;
  phone: string | null;
  rating: number;
  feedback_text: string | null;
  created_at: Date;
}

export interface DashboardStats {
  customers: number;
  reviews: number;
  avg_rating: number | null;
  unhappy: number;
  resolved: number;
  returning_this_month: number;
  ratings: [number, number, number, number, number]; // count of 5, 4, 3, 2, 1 star ratings
}

export async function getDashboard(slug: string) {
  const { user, client } = await requireClientAccess(slug);
  if (!client.dashboard_enabled) return { user, client, data: null };

  const id = client.id;
  const [stats, money, guests, alerts, birthdays] = await Promise.all([
    db().query<Omit<DashboardStats, 'ratings' | 'returning_this_month'> & { r5: number; r4: number; r3: number; r2: number; r1: number }>(
      `select (select count(*) from contacts where client_id = $1)::int as customers,
              count(*) filter (where path = 'happy')::int as reviews,
              round(avg(rating), 1)::float8 as avg_rating,
              count(*) filter (where path = 'unhappy')::int as unhappy,
              count(*) filter (where path = 'unhappy' and resolved_at is not null)::int as resolved,
              count(*) filter (where rating = 5)::int as r5,
              count(*) filter (where rating = 4)::int as r4,
              count(*) filter (where rating = 3)::int as r3,
              count(*) filter (where rating = 2)::int as r2,
              count(*) filter (where rating = 1)::int as r1
         from submissions where client_id = $1`,
      [id],
    ),
    // A return visit = a rating this month from a contact the system had already captured before.
    // That is the only thing the money view counts: nothing projected.
    db().query<{ returning: number; avg_ticket: string }>(
      `select (select count(*) from submissions s
                where s.client_id = $1 and s.contact_id is not null
                  and s.created_at >= (date_trunc('month', now() at time zone $2) at time zone $2)
                  and exists (select 1 from submissions p
                               where p.contact_id = s.contact_id and p.created_at < s.created_at))::int as returning,
              (select avg_ticket from clients where id = $1) as avg_ticket`,
      [id, TZ],
    ),
    db().query<Guest>(
      `select ct.id, ct.first_name, ct.last_name, ct.phone, ct.email, ct.birthday_month, ct.birthday_day,
              ct.visits, ct.sms_consent, ct.first_seen_at, ct.last_seen_at,
              ls.rating as last_rating, ls.feedback_text as last_feedback
         from contacts ct
         left join lateral (
           select rating, feedback_text from submissions where contact_id = ct.id order by created_at desc limit 1
         ) ls on true
        where ct.client_id = $1
        order by ct.last_seen_at desc
        limit 500`,
      [id],
    ),
    db().query<Alert>(
      `select id, first_name, phone, rating, feedback_text, created_at from submissions
        where client_id = $1 and path = 'unhappy' and resolved_at is null
        order by created_at desc limit 50`,
      [id],
    ),
    db().query<Guest>(
      `select id, first_name, last_name, phone, email, birthday_month, birthday_day, visits, sms_consent,
              first_seen_at, last_seen_at, null::smallint as last_rating, null::text as last_feedback
         from contacts
        where client_id = $1 and birthday_month = extract(month from now() at time zone $2)
        order by birthday_day nulls last`,
      [id, TZ],
    ),
  ]);

  const s = stats.rows[0];
  const returning = money.rows[0].returning;
  const avgTicket = Number(money.rows[0].avg_ticket);

  return {
    user,
    client,
    data: {
      stats: {
        customers: s.customers,
        reviews: s.reviews,
        avg_rating: s.avg_rating,
        unhappy: s.unhappy,
        resolved: s.resolved,
        returning_this_month: returning,
        ratings: [s.r5, s.r4, s.r3, s.r2, s.r1],
      } satisfies DashboardStats,
      avgTicket,
      estimate: returning * avgTicket,
      guests: guests.rows,
      alerts: alerts.rows,
      birthdays: birthdays.rows,
      // Dental recall: patients whose last visit is longest ago come first (6 month recall).
      recall: [...guests.rows].sort((a, b) => +a.last_seen_at - +b.last_seen_at).slice(0, 8),
    },
  };
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboard>>['data']>;

// All contacts of one client, for the CSV download. Caller must have checked access.
export async function getContactsForExport(clientId: string): Promise<Guest[]> {
  const { rows } = await db().query<Guest>(
    `select ct.id, ct.first_name, ct.last_name, ct.phone, ct.email, ct.birthday_month, ct.birthday_day,
            ct.visits, ct.sms_consent, ct.first_seen_at, ct.last_seen_at,
            ls.rating as last_rating, ls.feedback_text as last_feedback
       from contacts ct
       left join lateral (
         select rating, feedback_text from submissions where contact_id = ct.id order by created_at desc limit 1
       ) ls on true
      where ct.client_id = $1
      order by ct.last_seen_at desc`,
    [clientId],
  );
  return rows;
}
