import 'server-only';
import { db } from '@/lib/db';
import { requireClientAccess } from '@/lib/auth/dal';
import { sampleDashboard } from '@/lib/data/sample';

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

// Ratings on one day (New York date), for the 30 day chart.
export interface DayCount {
  day: string; // 2026-10-21
  happy: number;
  unhappy: number;
}

// One month's headline numbers, for the "this month vs last month" panel.
export interface MonthNumbers {
  ratings: number;
  happy: number;
  avg_rating: number | null;
  new_customers: number;
}

// QR scan -> rating -> Google, last 30 days.
export interface FunnelSteps {
  scans: number;
  ratings: number;
  happy: number;
  unhappy: number;
}

export interface RecentRating {
  id: string;
  first_name: string | null;
  rating: number;
  path: 'happy' | 'unhappy';
  created_at: Date;
}

export interface Regular {
  id: string;
  first_name: string | null;
  last_name: string | null;
  visits: number;
  last_seen_at: Date;
}

// People who haven't been back: gone 30 to 59, 60 to 89 and 90+ days, and how many of them agreed to texts.
export interface WinBack {
  d30: number;
  d60: number;
  d90: number;
  textable: number;
}

// Ratings by weekday (0 = Sunday) and time of day: Morning 5-11, Lunch 11-3, Afternoon 3-6, Evening 6-10, Late 10-5.
export const HEAT_BLOCKS = ['Morning', 'Lunch', 'Afternoon', 'Evening', 'Late'] as const;
export type Heat = number[][]; // [weekday 0..6][block 0..4]

export async function getDashboard(slug: string) {
  const { user, client } = await requireClientAccess(slug);
  const id = client.id;

  // Sample data (an admin switch for demos) shows even when the dashboard is off, and reads no customer rows.
  if (client.dashboard_sample) {
    const { rows: [c] } = await db().query<{ avg_ticket: string }>('select avg_ticket from clients where id = $1', [id]);
    return { user, client, data: sampleDashboard(client, Number(c.avg_ticket)) };
  }
  if (!client.dashboard_enabled) return { user, client, data: null };

  const [stats, money, guests, alerts, birthdays, daily, months, funnel, recent, heat, winback, regulars] = await Promise.all([
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
    db().query<DayCount>(
      `select to_char(d, 'YYYY-MM-DD') as day,
              count(s.id) filter (where s.path = 'happy')::int as happy,
              count(s.id) filter (where s.path = 'unhappy')::int as unhappy
         from generate_series((now() at time zone $2)::date - 29, (now() at time zone $2)::date, interval '1 day') d
         left join submissions s on s.client_id = $1 and (s.created_at at time zone $2)::date = d::date
        group by d order by d`,
      [id, TZ],
    ),
    // This month vs last month (New York calendar months).
    db().query<{ t_ratings: number; t_happy: number; t_avg: number | null; t_new: number; l_ratings: number; l_happy: number; l_avg: number | null; l_new: number }>(
      `with b as (
         select (date_trunc('month', now() at time zone $2) at time zone $2) as m0,
                ((date_trunc('month', now() at time zone $2) - interval '1 month') at time zone $2) as m1
       )
       select count(s.id) filter (where s.created_at >= b.m0)::int as t_ratings,
              count(s.id) filter (where s.created_at >= b.m0 and s.path = 'happy')::int as t_happy,
              round(avg(s.rating) filter (where s.created_at >= b.m0), 1)::float8 as t_avg,
              (select count(*) from contacts c where c.client_id = $1 and c.first_seen_at >= b.m0)::int as t_new,
              count(s.id) filter (where s.created_at < b.m0)::int as l_ratings,
              count(s.id) filter (where s.created_at < b.m0 and s.path = 'happy')::int as l_happy,
              round(avg(s.rating) filter (where s.created_at < b.m0), 1)::float8 as l_avg,
              (select count(*) from contacts c where c.client_id = $1 and c.first_seen_at >= b.m1 and c.first_seen_at < b.m0)::int as l_new
         from b left join submissions s on s.client_id = $1 and s.created_at >= b.m1
        group by b.m0, b.m1`,
      [id, TZ],
    ),
    db().query<FunnelSteps>(
      `select (select count(*) from funnel_scans where client_id = $1 and created_at > now() - interval '30 days')::int as scans,
              count(*)::int as ratings,
              count(*) filter (where path = 'happy')::int as happy,
              count(*) filter (where path = 'unhappy')::int as unhappy
         from submissions where client_id = $1 and created_at > now() - interval '30 days'`,
      [id],
    ),
    db().query<RecentRating>(
      `select id, first_name, rating, path, created_at from submissions
        where client_id = $1 order by created_at desc limit 8`,
      [id],
    ),
    db().query<{ dow: number; block: number; n: number }>(
      `select dow, block, count(*)::int as n from (
         select extract(dow from created_at at time zone $2)::int as dow,
                case when h >= 5 and h < 11 then 0 when h >= 11 and h < 15 then 1 when h >= 15 and h < 18 then 2
                     when h >= 18 and h < 22 then 3 else 4 end as block
           from (select created_at, extract(hour from created_at at time zone $2)::int as h
                   from submissions where client_id = $1 and created_at > now() - interval '90 days') x
       ) y group by dow, block`,
      [id, TZ],
    ),
    db().query<WinBack>(
      `select count(*) filter (where last_seen_at <= now() - interval '30 days' and last_seen_at > now() - interval '60 days')::int as d30,
              count(*) filter (where last_seen_at <= now() - interval '60 days' and last_seen_at > now() - interval '90 days')::int as d60,
              count(*) filter (where last_seen_at <= now() - interval '90 days')::int as d90,
              count(*) filter (where last_seen_at <= now() - interval '30 days' and sms_consent and sms_opted_out_at is null)::int as textable
         from contacts where client_id = $1`,
      [id],
    ),
    db().query<Regular>(
      `select id, first_name, last_name, visits, last_seen_at from contacts
        where client_id = $1 and visits > 1 order by visits desc, last_seen_at desc limit 5`,
      [id],
    ),
  ]);

  const heatGrid: Heat = Array.from({ length: 7 }, () => [0, 0, 0, 0, 0]);
  for (const r of heat.rows) heatGrid[r.dow][r.block] = r.n;
  const m = months.rows[0];

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
      daily: daily.rows,
      months: {
        this: { ratings: m.t_ratings, happy: m.t_happy, avg_rating: m.t_avg, new_customers: m.t_new },
        last: { ratings: m.l_ratings, happy: m.l_happy, avg_rating: m.l_avg, new_customers: m.l_new },
      } satisfies { this: MonthNumbers; last: MonthNumbers },
      funnel: funnel.rows[0],
      recent: recent.rows,
      heat: heatGrid,
      winback: winback.rows[0],
      regulars: regulars.rows,
      sample: false,
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
