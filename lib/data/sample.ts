import 'server-only';
import type { ClientSummary } from '@/lib/auth/dal';
import type { Alert, DashboardStats, DayCount, Guest, Heat, MonthNumbers, RecentRating, Regular, WinBack } from '@/lib/data/dashboard';

// Made up numbers for demos: what a busy client's dashboard looks like after a few months.
// Turned on per client by an admin ("Sample data" on /d/{slug}); nothing here touches the database.
// Seeded by the client's slug, so the same client shows the same people on every refresh.

const FIRST = ['Erica', 'Jordan', 'Maya', 'Luis', 'Priya', 'Daniel', 'Aisha', 'Marco', 'Chloe', 'Andre', 'Nina', 'Sam',
  'Olivia', 'Kevin', 'Sofia', 'Tyler', 'Grace', 'Omar', 'Hannah', 'Jamal', 'Rosa', 'Ethan', 'Leah', 'Victor', 'Zoe',
  'Isaac', 'Mia', 'Derek', 'Tanya', 'Felix'];
const LAST = ['Brooks', 'Reyes', 'Patel', 'Chen', 'Morgan', 'Okafor', 'Rossi', 'Kim', 'Bennett', 'Diaz', 'Walsh',
  'Nguyen', 'Carter', 'Haddad', 'Lopez', 'Fischer', 'Grant', 'Silva', 'Park', 'Hughes'];

const PRAISE = {
  hospitality: ['Best night out in months.', 'The bartender remembered our order.', 'Food came out fast and hot.',
    'Great music, great crowd.', 'Our server was fantastic.', 'Loved the cocktails.', null, null],
  dental: ['Painless cleaning, thank you!', 'Front desk was so friendly.', 'On time, in and out.',
    'Dr. explained everything clearly.', 'Best dental visit I have had.', null, null],
};
const COMPLAINTS = {
  hospitality: ['Waited 40 minutes for a table even with a reservation.', 'Drinks were warm and the music was too loud to talk.',
    'Got charged twice on my card, still waiting on a refund.', 'Order came out wrong and nobody checked on us.'],
  dental: ['Waited 35 minutes past my appointment time.', 'Billing was confusing, I was charged for something I did not get.',
    'Hygienist was rough and rushed the cleaning.', 'Could not get anyone on the phone to reschedule.'],
};

// Small seeded random number generator (mulberry32).
function seeded(text: string) {
  let a = [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleDashboard(client: ClientSummary, avgTicket: number) {
  const rand = seeded(client.slug);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const vertical = client.vertical;
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000 - int(0, 50_000_000));
  const month = Number(now.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'numeric' }));

  // Five ratings out of six are 4 or 5, which is what a working funnel looks like.
  const rating = () => { const r = rand(); return r < 0.62 ? 5 : r < 0.84 ? 4 : r < 0.91 ? 3 : r < 0.96 ? 2 : 1; };

  const total = int(180, 260);
  const guests: Guest[] = Array.from({ length: total }, (_, i) => {
    const last = daysAgo(Math.floor((i / total) * 120 * rand()));
    const r = rating();
    return {
      id: `sample-${i}`,
      first_name: pick(FIRST),
      last_name: rand() < 0.7 ? pick(LAST) : null,
      phone: `${pick(['917', '646', '212', '718', '347'])}555${String(int(0, 9999)).padStart(4, '0')}`,
      email: null,
      birthday_month: rand() < 0.75 ? (i % 9 === 0 ? month : int(1, 12)) : null,
      birthday_day: int(1, 28),
      visits: rand() < 0.35 ? int(2, 7) : 1,
      sms_consent: rand() < 0.8,
      first_seen_at: daysAgo(int(120, 200)),
      last_seen_at: last,
      last_rating: r,
      last_feedback: r >= 4 ? pick(PRAISE[vertical]) : r === 3 ? 'It was fine.' : pick(COMPLAINTS[vertical]),
    };
  }).sort((a, b) => +b.last_seen_at - +a.last_seen_at);

  const ratings: DashboardStats['ratings'] = [0, 0, 0, 0, 0];
  for (let i = 0; i < Math.round(total * 1.4); i++) ratings[5 - rating()]++;
  const count = ratings.reduce((a, b) => a + b, 0);
  // Same split as the funnel: 4 and 5 go to Google, 1 to 3 go to the manager.
  const reviews = ratings[0] + ratings[1];
  const unhappy = count - reviews;

  const alerts: Alert[] = COMPLAINTS[vertical].slice(0, 3).map((text, i) => ({
    id: `sample-alert-${i}`,
    first_name: pick(FIRST),
    phone: rand() < 0.8 ? `646555${String(int(0, 9999)).padStart(4, '0')}` : null,
    rating: i === 0 ? 1 : 2,
    feedback_text: text,
    created_at: daysAgo(i * 2),
  }));

  // Last 30 days of ratings, busier on Fridays and Saturdays for hospitality.
  const daily: DayCount[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * 86_400_000);
    const busy = vertical === 'hospitality' ? [1, 0.7, 0.8, 0.9, 1.2, 1.8, 1.6][d.getDay()] : d.getDay() % 6 === 0 ? 0.2 : 1.1;
    const happy = Math.round(int(3, 9) * busy);
    return { day: d.toISOString().slice(0, 10), happy, unhappy: rand() < 0.3 ? int(1, 2) : 0 };
  });

  const returning = int(28, 46);
  const birthdays = guests
    .filter((g) => g.birthday_month === month)
    .slice(0, 9)
    .sort((a, b) => (a.birthday_day ?? 0) - (b.birthday_day ?? 0))
    .map((g) => ({ ...g, last_rating: null, last_feedback: null }));

  const happy30 = daily.reduce((n, d) => n + d.happy, 0);
  const unhappy30 = daily.reduce((n, d) => n + d.unhappy, 0);

  const monthNumbers = (ratingsN: number, avg: number): MonthNumbers => ({
    ratings: ratingsN,
    happy: Math.round(ratingsN * 0.86),
    avg_rating: avg,
    new_customers: Math.round(ratingsN * (0.42 + rand() * 0.12)),
  });
  const thisMonth = monthNumbers(int(95, 140), Math.round((4.3 + Math.round(rand() * 3) / 10) * 10) / 10);
  const lastMonth = monthNumbers(int(80, 125), Math.round((4.1 + Math.round(rand() * 3) / 10) * 10) / 10);

  // Weekday x time of day. Bars and restaurants peak Friday and Saturday evenings; dental is weekday daytime.
  const weights = vertical === 'hospitality'
    ? [[0, 2, 3, 6, 2], [0, 3, 2, 4, 1], [0, 3, 2, 5, 1], [0, 3, 3, 6, 2], [0, 4, 4, 8, 3], [0, 4, 6, 12, 8], [0, 5, 6, 11, 6]]
    : [[0, 0, 0, 0, 0], [6, 5, 4, 1, 0], [7, 6, 5, 1, 0], [6, 5, 4, 1, 0], [7, 6, 5, 1, 0], [5, 4, 2, 0, 0], [3, 1, 0, 0, 0]];
  const heat: Heat = weights.map((row) => row.map((w) => (w ? Math.round(w * (0.7 + rand() * 0.6)) : 0)));

  const recent: RecentRating[] = guests.slice(0, 8).map((g, i) => ({
    id: `sample-recent-${i}`,
    first_name: g.first_name,
    rating: g.last_rating ?? 5,
    path: (g.last_rating ?? 5) >= 4 ? 'happy' : 'unhappy',
    created_at: g.last_seen_at,
  }));

  const regulars: Regular[] = [...guests]
    .sort((a, b) => b.visits - a.visits || +b.last_seen_at - +a.last_seen_at)
    .slice(0, 5)
    .map((g) => ({ id: g.id, first_name: g.first_name, last_name: g.last_name, visits: g.visits, last_seen_at: g.last_seen_at }));

  const winback: WinBack = { d30: int(24, 40), d60: int(14, 26), d90: int(18, 34), textable: 0 };
  winback.textable = Math.round((winback.d30 + winback.d60 + winback.d90) * 0.78);

  return {
    months: { this: thisMonth, last: lastMonth },
    funnel: { scans: Math.round((happy30 + unhappy30) * 1.55), ratings: happy30 + unhappy30, happy: happy30, unhappy: unhappy30 },
    recent,
    heat,
    winback,
    regulars,
    stats: {
      customers: total,
      reviews,
      avg_rating: Math.round(((ratings[0] * 5 + ratings[1] * 4 + ratings[2] * 3 + ratings[3] * 2 + ratings[4]) / count) * 10) / 10,
      unhappy,
      resolved: unhappy - alerts.length,
      returning_this_month: returning,
      ratings,
    } satisfies DashboardStats,
    avgTicket,
    estimate: returning * avgTicket,
    guests: guests.slice(0, 30),
    alerts,
    birthdays,
    recall: [...guests].sort((a, b) => +a.last_seen_at - +b.last_seen_at).slice(0, 8),
    daily,
    sample: true,
  };
}
