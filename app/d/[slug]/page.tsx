import { Suspense, type CSSProperties, type ReactNode } from 'react';
import { HEAT_BLOCKS, getDashboard, type DashboardData, type Guest } from '@/lib/data/dashboard';
import type { ClientSummary, CurrentUser } from '@/lib/auth/dal';
import { AppHeader, headerButton as button, inkOn } from '@/app/ui/app-header';
import { requestUpgrade, resolveAlert } from './actions';
import { LookBar } from './look-bar';

// Client dashboard: /d/kyma. Only Kyma's own logins (and admins) get past requireClientAccess.
// Layout and wording follow renderClientDash() / renderWall() in Mario's demo.
export default function ClientDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-16 pt-6">
      <Suspense fallback={<p className="text-dim">Loading…</p>}>
        <Dashboard params={params} />
      </Suspense>
    </div>
  );
}

const TIERS = { 1: 'Capture', 2: 'Command', 3: 'Revenue' } as const;
const COMMAND_PRICE = { hospitality: '$499/mo', dental: '$999/mo' } as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const zone = 'rounded-2xl border border-border bg-surface p-6';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const date = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
const stars = (n: number | null) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '');
const birthday = (g: Guest) => (g.birthday_month ? `${MONTHS[g.birthday_month - 1]} ${g.birthday_day ?? ''}`.trim() : '');
// Six month recall from the patient's last visit.
const recallDue = (g: Guest) => {
  const d = new Date(g.last_seen_at);
  d.setMonth(d.getMonth() + 6);
  return d;
};
const phone = (p: string | null) => (p && p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p ?? '');

async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, client, data } = await getDashboard(slug);
  const hosp = client.vertical === 'hospitality';

  const look = { theme: client.dashboard_theme, style: client.dashboard_style, sample: client.dashboard_sample };

  return (
    <div data-dash-theme={client.dashboard_theme} style={{ '--client': client.brand_color } as CSSProperties}>
      <AppHeader
        title={client.name}
        subtitle={`${hosp ? 'Hospitality' : 'Dental'}, Tier ${client.tier} ${TIERS[client.tier]}`}
        userName={user.name}
        mark={client.brand_color}
      >
        {user.role === 'admin' && <a href="/admin" className={button}>Back to admin</a>}
        {data && !data.sample && <a href={`/d/${client.slug}/contacts.csv`} className={button}>Download my sheet</a>}
      </AppHeader>
      {user.role === 'admin' && <LookBar clientId={client.id} look={look} />}
      {!data ? (
        <Wall client={client} user={user} />
      ) : client.dashboard_style === 'spotlight' ? (
        <Spotlight v={view(client, data)} />
      ) : client.dashboard_style === 'tiles' ? (
        <Tiles v={view(client, data)} />
      ) : (
        <Classic v={view(client, data)} />
      )}
    </div>
  );
}

// Dashboard off (Tier 1, or switched off): the upsell wall instead of numbers.
function Wall({ client, user }: { client: ClientSummary; user: CurrentUser }) {
  const requested = Boolean(client.upgrade_requested_at);
  return (
    <div className="grid min-h-[55vh] place-items-center text-center">
      <div className="max-w-[460px] rounded-2xl border border-border bg-surface px-8 py-10">
        <h2 className="mb-3 font-serif text-[24px] font-bold leading-snug">Your numbers live on the Command plan</h2>
        <p className="mb-7 text-[15px] leading-relaxed text-dim">
          Your QR funnel is live and every {client.vertical === 'dental' ? 'patient' : 'customer'} is being saved. Upgrade to
          Command to see this dashboard, get unhappy alerts and turn on birthday texts.
        </p>
        {requested ? (
          <p className="font-medium text-ok">Upgrade requested. EMRG Media will be in touch.</p>
        ) : (
          <form action={requestUpgrade.bind(null, client.slug)}>
            <button type="submit" className="rounded-xl bg-text px-5 py-3 text-[15px] font-semibold text-bg hover:opacity-90">
              Request Command, {COMMAND_PRICE[client.vertical]}
            </button>
          </form>
        )}
        {user.role === 'admin' && (
          <p className="mt-5 text-xs text-dim">You see this because the dashboard is off. Turn it on from the client card.</p>
        )}
      </div>
    </div>
  );
}

// What every layout shows, worked out once. The three layouts below only arrange these pieces.
type View = ReturnType<typeof view>;

function view(client: ClientSummary, data: DashboardData) {
  const hosp = client.vertical === 'hospitality';
  const { stats } = data;
  const t = client.tier;
  const people = hosp ? 'customers' : 'patients';
  const unit = hosp ? 'visits' : 'appointments';

  const autos = hosp
    ? [
        { on: t >= 2, h: 'Save the sale alerts', p: t >= 2 ? 'Owner is texted within 60 seconds of any unhappy rating.' : `Turn on to catch ${stats.unhappy} unhappy customers before they hit Google.` },
        { on: t >= 2, h: 'Birthday texts', p: t >= 2 ? `${plural(data.birthdays.length, 'birthday')} this month, texts fire automatically at 10 AM.` : `Turn on to reach ${plural(data.birthdays.length, 'birthday')} this month.` },
        { on: t >= 3, h: 'Win back texts', p: t >= 3 ? 'Customers gone 30, 60, 90 days get an offer automatically.' : `Turn on to reach ${stats.customers} past customers.` },
        { on: t >= 3, h: 'Slow night and VIP blasts', p: t >= 3 ? 'One tap sends an offer to your whole list.' : 'Included in Revenue tier.' },
      ]
    : [
        { on: t >= 2, h: 'Save the patient alerts', p: t >= 2 ? 'Office manager is texted within 60 seconds of any unhappy rating.' : `Turn on to catch ${stats.unhappy} unhappy patients before they post.` },
        { on: t >= 2, h: 'Recall and birthday texts', p: t >= 2 ? '6 month recall reminders and birthday texts fire automatically.' : `Turn on to reach ${stats.customers} patients.` },
        { on: t >= 2, h: 'AI review replies', p: t >= 2 ? 'New Google reviews get a drafted reply in your voice. You tap send.' : 'Included in Command tier.' },
        { on: t >= 3, h: 'Reactivation campaigns', p: t >= 3 ? 'Patients not seen in 12 months get a reactivation offer.' : 'Turn on to reach lapsed patients.' },
      ];

  const moneyNote = data.estimate
    ? `Counts only ${unit} this month from ${people} the system already had on file, times your average ${hosp ? 'ticket' : 'visit'} of ${money(data.avgTicket)}. Nothing projected, nothing promised.`
    : `Nothing counted yet. This number only moves when a ${hosp ? 'customer' : 'patient'} this system reached comes back. ${t >= 3 ? 'Give the texts 30 days.' : 'Turn on win back to start.'}`;

  const figures = [
    { label: hosp ? 'Customers' : 'Patients', value: stats.customers },
    { label: 'Sent to Google', value: stats.reviews },
    { label: 'Average rating', value: stats.avg_rating ?? '—' },
    { label: hosp ? 'Birthdays this month' : 'Alerts handled', value: hosp ? data.birthdays.length : `${stats.resolved}/${stats.unhappy}` },
    { label: 'Unhappy caught', value: stats.unhappy },
  ];

  return { client, data, stats, hosp, unit, autos, moneyNote, figures };
}

// ---------- Layout 1: Classic. Editorial, the money figure first, then everything in reading order. ----------

function Classic({ v }: { v: View }) {
  return (
    <>
      <section className="mb-10 grid gap-6 border-b border-border pb-10 md:grid-cols-[auto_1fr] md:items-end md:gap-12">
        <div>
          <p className="mb-3 text-[13px] text-dim">Brought back this month, estimated</p>
          <p className="figure text-[64px] font-bold leading-[.9] sm:text-[80px]">{money(v.data.estimate)}</p>
        </div>
        <Returning v={v} />
      </section>

      <section className="mb-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-surface sm:grid-cols-3 lg:grid-cols-5">
        {v.figures.map((f) => <Figure key={f.label} label={f.label} value={f.value} />)}
      </section>

      <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Months v={v} className={zone} />
        <Funnel v={v} className={zone} />
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-serif text-[19px] font-bold">Automations</h2>
        <Automations v={v} columns />
      </section>

      <Alerts v={v} className="mb-6" />

      <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Ratings v={v} className={zone} />
        <SideList v={v} className={zone} />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Recent v={v} className={zone} />
        <Busiest v={v} className={zone} />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WinBackList v={v} className={zone} />
        <Regulars v={v} className={zone} />
      </section>

      <KitCard v={v} className={`${zone} mb-6`} />
      <Guests v={v} />
    </>
  );
}

// ---------- Layout 2: Spotlight. A big panel in the client's own color, the 30 day chart, two columns. ----------

function Spotlight({ v }: { v: View }) {
  const ink = inkOn(v.client.brand_color);
  return (
    <>
      <section
        className="mb-8 grid gap-8 overflow-hidden rounded-3xl p-7 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:items-end"
        style={{ background: v.client.brand_color, color: ink }}
      >
        <div>
          <p className="mb-3 text-[13px] opacity-75">Brought back this month, estimated</p>
          <p className="figure text-[68px] font-bold leading-[.9] sm:text-[92px]">{money(v.data.estimate)}</p>
          <p className="mt-5 text-[15px]">
            <span className="figure text-[22px] font-bold">{v.stats.returning_this_month}</span> returning{' '}
            {v.stats.returning_this_month === 1 ? v.unit.slice(0, -1) : v.unit}
          </p>
          <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed opacity-75">{v.moneyNote}</p>
        </div>
        <dl className="grid grid-cols-3 gap-4">
          {v.figures.slice(0, 3).map((f) => (
            <div key={f.label} className="flex flex-col-reverse border-t pt-3" style={{ borderColor: `${ink}33` }}>
              <dt className="mt-1.5 text-xs opacity-75">{f.label}</dt>
              <dd className="figure text-[30px] font-bold leading-none sm:text-[36px]">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-6">
          <div className={zone}>
            <Trend v={v} />
          </div>
          <Alerts v={v} />
          <Recent v={v} className={zone} />
          <SideList v={v} className={zone} />
          <Regulars v={v} className={zone} />
        </div>
        <div className="grid content-start gap-6">
          <Funnel v={v} className={zone} />
          <Months v={v} className={zone} />
          <Ratings v={v} className={zone} />
          <Busiest v={v} className={zone} />
          <WinBackList v={v} className={zone} />
          <div className={zone}>
            <ZoneHead title="Automations" note={`${v.autos.filter((a) => a.on).length} of ${v.autos.length} on`} />
            <Automations v={v} />
          </div>
          <KitCard v={v} className={zone} />
        </div>
      </div>

      <Guests v={v} />
    </>
  );
}

// ---------- Layout 3: Tiles. Everything at a glance in a grid of cards, numbers first. ----------

const tile = 'rounded-2xl border border-border bg-surface p-5';

function Tiles({ v }: { v: View }) {
  return (
    <>
      <section className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className={`${tile} col-span-2 border-l-4`} style={{ borderLeftColor: v.client.brand_color }}>
          <p className="text-[13px] text-dim">Brought back this month, estimated</p>
          <p className="figure mt-3 text-[56px] font-bold leading-none">{money(v.data.estimate)}</p>
          <p className="mt-3 text-[13px] text-dim">
            {plural(v.stats.returning_this_month, v.unit.slice(0, -1))} from people already on file, at {money(v.data.avgTicket)} each
          </p>
        </div>
        {v.figures.map((f) => (
          <div key={f.label} className={tile}>
            <p className="text-[13px] text-dim">{f.label}</p>
            <p className="figure mt-3 text-[36px] font-bold leading-none">{f.value}</p>
            {f.label === 'Average rating' && typeof f.value === 'number' && (
              <p className="mt-2 text-[15px] text-[var(--client)]" aria-hidden>{stars(Math.round(f.value))}</p>
            )}
          </div>
        ))}
        <div className={tile}>
          <p className="text-[13px] text-dim">Automations on</p>
          <p className="figure mt-3 text-[36px] font-bold leading-none">
            {v.autos.filter((a) => a.on).length}<span className="text-dim">/{v.autos.length}</span>
          </p>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${tile} lg:col-span-2`}>
          <Trend v={v} />
        </div>
        <Ratings v={v} className={tile} />
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Months v={v} className={tile} />
        <Funnel v={v} className={tile} />
        <WinBackList v={v} className={tile} />
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {v.data.alerts.length > 0 ? <Alerts v={v} /> : (
          <div className={tile}>
            <ZoneHead title="Unhappy customers" note="All handled" />
            <p className="text-dim">Nobody is waiting on a call back.</p>
          </div>
        )}
        <SideList v={v} className={tile} />
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Recent v={v} className={tile} />
        <Busiest v={v} className={tile} />
        <Regulars v={v} className={tile} />
      </section>

      <section className={`${tile} mb-4`}>
        <ZoneHead title="Automations" note={`Tier ${v.client.tier} ${TIERS[v.client.tier]}`} />
        <Automations v={v} columns />
      </section>

      <KitCard v={v} className={`${tile} mb-4`} />
      <Guests v={v} />
    </>
  );
}

// ---------- Pieces the layouts share ----------

function Returning({ v }: { v: View }) {
  return (
    <div className="max-w-[460px] md:pb-2">
      <p className="mb-2 text-[15px]">
        <span className="figure text-[22px] font-bold">{v.stats.returning_this_month}</span>{' '}
        returning {v.stats.returning_this_month === 1 ? v.unit.slice(0, -1) : v.unit}
      </p>
      <p className="text-[13px] leading-relaxed text-dim">{v.moneyNote}</p>
    </div>
  );
}

function Automations({ v, columns }: { v: View; columns?: boolean }) {
  return (
    <div className={`grid grid-cols-1 gap-x-10 gap-y-5 ${columns ? 'sm:grid-cols-2' : ''}`}>
      {v.autos.map((a) => (
        <div key={a.h} className="flex gap-3">
          <span aria-hidden className={`mt-[5px] size-2.5 shrink-0 rounded-full ${a.on ? 'bg-ok' : 'border border-dim'}`} />
          <div>
            <h3 className="text-[14px] font-semibold">
              {a.h} <span className={`ml-1 text-xs font-medium ${a.on ? 'text-ok' : 'text-dim'}`}>{a.on ? 'On' : 'Off'}</span>
            </h3>
            <p className="mt-0.5 text-[13px] leading-relaxed text-dim">{a.p}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Alerts({ v, className = '' }: { v: View; className?: string }) {
  if (!v.data.alerts.length) return null;
  return (
    <section className={`${zone} border-alert/50 shadow-[inset_3px_0_0_var(--color-alert)] ${className}`}>
      <ZoneHead title={v.hosp ? 'Unhappy customers to call back' : 'Unhappy patients to call back'} note={`${v.data.alerts.length} open`} />
      <ul className="divide-y divide-border">
        {v.data.alerts.map((a) => (
          <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
            <div>
              <span className="font-medium">{a.first_name || 'Anonymous'}</span>{' '}
              <span className="ml-1 text-brand" aria-label={`${a.rating} out of 5`}>{stars(a.rating)}</span>
              <div className="mt-0.5 text-xs text-dim">{phone(a.phone) || 'No phone left'}, {date(a.created_at)}</div>
              {a.feedback_text && <p className="mt-1.5 max-w-[65ch] font-serif text-[14px] leading-relaxed">“{a.feedback_text}”</p>}
            </div>
            {v.data.sample ? (
              <button type="button" disabled className={`${button} opacity-60`}>Mark resolved</button>
            ) : (
              <form action={resolveAlert.bind(null, a.id)}>
                <button type="submit" className={button}>Mark resolved</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Ratings({ v, className }: { v: View; className: string }) {
  const max = Math.max(1, ...v.stats.ratings);
  return (
    <div className={className}>
      <ZoneHead title="Ratings" note={`${v.stats.ratings.reduce((a, b) => a + b, 0)} total`} />
      <div className="grid gap-2.5">
        {[5, 4, 3, 2, 1].map((r, i) => (
          <div key={r} className="grid grid-cols-[44px_1fr_32px] items-center gap-3 text-[13px]">
            <span className="text-dim">{r} star</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
              <div className="h-full rounded-full bg-[var(--client)]" style={{ width: `${(v.stats.ratings[i] / max) * 100}%` }} />
            </div>
            <span className="text-right tabular-nums">{v.stats.ratings[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Ratings per day for the last 30 days: happy in the client's color, unhappy stacked on top in red.
function Trend({ v }: { v: View }) {
  const days = v.data.daily;
  const max = Math.max(1, ...days.map((d) => d.happy + d.unhappy));
  const total = days.reduce((n, d) => n + d.happy + d.unhappy, 0);
  const w = 100 / days.length;
  const label = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <>
      <ZoneHead title="Last 30 days" note={`${plural(total, 'rating')}`} />
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label={`${total} ratings in the last 30 days`}>
        {days.map((d, i) => {
          const hh = (d.happy / max) * 38;
          const uh = (d.unhappy / max) * 38;
          return (
            <g key={d.day}>
              <title>{`${label(d.day)}: ${d.happy} happy, ${d.unhappy} unhappy`}</title>
              <rect x={i * w + w * 0.18} width={w * 0.64} y={40 - hh} height={hh} fill="var(--client)" rx="0.4" />
              {d.unhappy > 0 && <rect x={i * w + w * 0.18} width={w * 0.64} y={40 - hh - uh} height={uh} fill="var(--color-alert)" rx="0.4" />}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-dim">
        <span>{days[0] && label(days[0].day)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[var(--client)]" /> Happy</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-alert" /> Unhappy</span>
        </span>
        <span>Today</span>
      </div>
    </>
  );
}

function SideList({ v, className }: { v: View; className: string }) {
  const side = v.hosp ? v.data.birthdays : v.data.recall;
  return (
    <div className={className}>
      <ZoneHead
        title={v.hosp ? 'Birthdays this month' : 'Recall list'}
        note={v.hosp ? plural(v.data.birthdays.length, 'guest') : plural(v.stats.customers, 'patient')}
      />
      {side.length ? (
        <Table head={['Name', v.hosp ? 'Birthday' : 'Last visit', ...(v.hosp ? [] : ['Recall due']), 'Phone']}>
          {side.map((g) => (
            <tr key={g.id}>
              <Td>{g.first_name}</Td>
              <Td>{v.hosp ? birthday(g) : date(g.last_seen_at)}</Td>
              {!v.hosp && <Td>{date(recallDue(g))}</Td>}
              <Td className="whitespace-nowrap tabular-nums">{phone(g.phone)}</Td>
            </tr>
          ))}
        </Table>
      ) : (
        <p className="text-dim">
          {v.hosp ? 'No birthdays this month yet. Guests add theirs when they rate you.' : 'No patients yet. They appear after their first rating.'}
        </p>
      )}
    </div>
  );
}

function Guests({ v }: { v: View }) {
  return (
    <section className={zone}>
      <ZoneHead title={v.hosp ? 'Guest list' : 'Patient list'} note={`Only ${v.client.name} can see this`} />
      {v.data.guests.length ? (
        <div className="-mx-2 overflow-x-auto">
          <Table wide head={['Name', 'Phone', 'Birthday', 'Rating', 'Visits', 'Feedback', 'Last seen']}>
            {v.data.guests.map((g) => (
              <tr key={g.id}>
                <Td>{[g.first_name, g.last_name].filter(Boolean).join(' ')}</Td>
                <Td className="whitespace-nowrap tabular-nums">{phone(g.phone)}</Td>
                <Td>{birthday(g)}</Td>
                <Td className="whitespace-nowrap text-brand">{stars(g.last_rating)}</Td>
                <Td className="tabular-nums">{g.visits}</Td>
                <Td className="max-w-[28ch]">{g.last_feedback}</Td>
                <Td className="whitespace-nowrap tabular-nums">{date(g.last_seen_at)}</Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : (
        <p className="text-dim">Nothing yet. Scan your QR code and leave a test rating to see it here.</p>
      )}
    </section>
  );
}

// "+12%" / "-4%" against last month; a plain difference for the average rating.
function change(now: number, before: number, kind: 'percent' | 'points' = 'percent') {
  if (kind === 'points') {
    const d = Math.round((now - before) * 10) / 10;
    return d === 0 ? { text: 'Same', tone: 'text-dim' } : { text: `${d > 0 ? '+' : ''}${d}`, tone: d > 0 ? 'text-ok' : 'text-alert' };
  }
  if (before === 0) return now > 0 ? { text: 'New', tone: 'text-ok' } : { text: '—', tone: 'text-dim' };
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? { text: 'Same', tone: 'text-dim' } : { text: `${pct > 0 ? '+' : ''}${pct}%`, tone: pct > 0 ? 'text-ok' : 'text-alert' };
}

function ago(d: Date) {
  const mins = Math.max(1, Math.round((Date.now() - +d) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : date(d);
}

function Months({ v, className }: { v: View; className: string }) {
  const { this: now, last } = v.data.months;
  const rows: { label: string; a: number | null; b: number | null; kind?: 'points' }[] = [
    { label: 'Ratings', a: now.ratings, b: last.ratings },
    { label: 'Sent to Google', a: now.happy, b: last.happy },
    { label: 'Average rating', a: now.avg_rating, b: last.avg_rating, kind: 'points' },
    { label: v.hosp ? 'New customers' : 'New patients', a: now.new_customers, b: last.new_customers },
  ];
  return (
    <div className={className}>
      <ZoneHead title="This month vs last" note={new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'long' })} />
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-4 gap-y-3 whitespace-nowrap text-[13px]">
        <span />
        <span className="text-right text-xs text-dim">This</span>
        <span className="text-right text-xs text-dim">Last</span>
        <span className="text-right text-xs text-dim">Change</span>
        {rows.map((r) => {
          const c = r.a != null && r.b != null ? change(r.a, r.b, r.kind) : { text: '—', tone: 'text-dim' };
          return (
            <div key={r.label} className="contents">
              <span>{r.label}</span>
              <span className="figure text-right text-[17px] font-bold tabular-nums">{r.a ?? '—'}</span>
              <span className="text-right tabular-nums text-dim">{r.b ?? '—'}</span>
              <span className={`text-right text-xs font-medium tabular-nums ${c.tone}`}>{c.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Funnel({ v, className }: { v: View; className: string }) {
  const f = v.data.funnel;
  const top = Math.max(1, f.scans, f.ratings);
  const steps = [
    { label: 'Scanned your QR code', n: f.scans, color: 'bg-dim/40' },
    { label: 'Left a rating', n: f.ratings, color: 'bg-[var(--client)]' },
    { label: 'Sent to Google', n: f.happy, color: 'bg-ok' },
    { label: 'Kept private, sent to you', n: f.unhappy, color: 'bg-alert' },
  ];
  const rate = f.scans ? Math.min(100, Math.round((f.ratings / f.scans) * 100)) : null;
  return (
    <div className={className}>
      <ZoneHead title="From scan to review" note="Last 30 days" />
      <div className="grid gap-3.5">
        {steps.map((st) => (
          <div key={st.label}>
            <div className="mb-1.5 flex justify-between text-[13px]">
              <span>{st.label}</span>
              <span className="figure font-bold tabular-nums">{st.n}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
              <div className={`h-full rounded-full ${st.color}`} style={{ width: `${(st.n / top) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-dim">
        {rate != null
          ? `${rate}% of the people who scanned left a rating.`
          : 'Scans show up here once people start opening your QR page.'}
      </p>
    </div>
  );
}

function Recent({ v, className }: { v: View; className: string }) {
  return (
    <div className={className}>
      <ZoneHead title="Latest ratings" note="Newest first" />
      {v.data.recent.length ? (
        <ul className="divide-y divide-border">
          {v.data.recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-[13px]">
              <span className="min-w-0 truncate">
                <span className="font-medium">{r.first_name || 'Anonymous'}</span>{' '}
                <span className="ml-1 text-brand" aria-label={`${r.rating} out of 5`}>{stars(r.rating)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2.5 text-xs text-dim">
                <span className={`rounded-full px-2 py-0.5 font-medium ${r.path === 'happy' ? 'bg-ok/10 text-ok' : 'bg-alert/10 text-alert'}`}>
                  {r.path === 'happy' ? 'Google' : 'Manager'}
                </span>
                {ago(r.created_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-dim">Nothing yet. Ratings appear here the moment someone scans.</p>
      )}
    </div>
  );
}

const DAYS = [
  { dow: 1, label: 'Mon', long: 'Monday' }, { dow: 2, label: 'Tue', long: 'Tuesday' }, { dow: 3, label: 'Wed', long: 'Wednesday' },
  { dow: 4, label: 'Thu', long: 'Thursday' }, { dow: 5, label: 'Fri', long: 'Friday' }, { dow: 6, label: 'Sat', long: 'Saturday' },
  { dow: 0, label: 'Sun', long: 'Sunday' },
];

// When ratings come in: weekday rows, time of day columns, darker = busier.
function Busiest({ v, className }: { v: View; className: string }) {
  const heat = v.data.heat;
  const max = Math.max(...heat.flat());
  let best = { dow: 0, block: 0, n: 0 };
  heat.forEach((row, dow) => row.forEach((n, block) => { if (n > best.n) best = { dow, block, n }; }));
  const bestDay = DAYS.find((d) => d.dow === best.dow)!.long;
  return (
    <div className={className}>
      <ZoneHead title="Busiest times" note="Last 90 days" />
      {max > 0 ? (
        <>
          <div className="grid grid-cols-[34px_repeat(5,1fr)] gap-1 text-[11px]">
            <span />
            {['Morn', 'Lunch', 'Aft', 'Eve', 'Late'].map((b) => <span key={b} className="text-center text-dim">{b}</span>)}
            {DAYS.map((d) => (
              <div key={d.dow} className="contents">
                <span className="self-center text-dim">{d.label}</span>
                {heat[d.dow].map((n, b) => (
                  <span
                    key={b}
                    title={`${d.long} ${HEAT_BLOCKS[b].toLowerCase()}: ${plural(n, 'rating')}`}
                    className="h-7 rounded-md bg-surface2"
                    style={n ? { background: `color-mix(in srgb, var(--client) ${Math.max(16, Math.round((n / max) * 100))}%, transparent)` } : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="mt-3.5 text-[13px] text-dim">
            Busiest: <span className="text-text">{bestDay} {HEAT_BLOCKS[best.block].toLowerCase()}</span>.
          </p>
        </>
      ) : (
        <p className="text-dim">Needs a few ratings first. Then you’ll see which days and times are busiest.</p>
      )}
    </div>
  );
}

function WinBackList({ v, className }: { v: View; className: string }) {
  const w = v.data.winback;
  const gone = w.d30 + w.d60 + w.d90;
  const bands = [
    { label: '30 to 60 days', n: w.d30 },
    { label: '60 to 90 days', n: w.d60 },
    { label: '90+ days', n: w.d90 },
  ];
  return (
    <div className={className}>
      <ZoneHead title={v.hosp ? 'Win back list' : 'Lapsed patients'} note={`${gone} not seen in 30+ days`} />
      <div className="grid grid-cols-3 gap-3">
        {bands.map((b) => (
          <div key={b.label} className="border-t border-border pt-3">
            <div className="figure text-[26px] font-bold leading-none">{b.n}</div>
            <div className="mt-1.5 text-xs text-dim">{b.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-dim">
        {gone
          ? `${w.textable} of them agreed to texts, so ${v.client.tier >= 3 ? 'win back texts reach them automatically' : 'they can be reached once win back texts are on'}.`
          : `Everyone on your list has visited in the last 30 days.`}
      </p>
    </div>
  );
}

function Regulars({ v, className }: { v: View; className: string }) {
  return (
    <div className={className}>
      <ZoneHead title={v.hosp ? 'Regulars' : 'Most loyal patients'} note="Most visits" />
      {v.data.regulars.length ? (
        <ul className="divide-y divide-border">
          {v.data.regulars.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-[13px]">
              <span className="font-medium">{[g.first_name, g.last_name].filter(Boolean).join(' ') || 'Guest'}</span>
              <span className="text-xs text-dim">
                <span className="figure mr-1 text-[15px] font-bold text-text">{g.visits}</span>
                visits, last {date(g.last_seen_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-dim">No one has come back yet. Repeat guests show up here once they rate a second time.</p>
      )}
    </div>
  );
}

function KitCard({ v, className }: { v: View; className: string }) {
  const base = `/d/${v.client.slug}/kit`;
  return (
    <section className={className}>
      <ZoneHead title="Your QR kit" note="Print and put it where people can scan" />
      <div className="flex flex-wrap items-center gap-2">
        <a href={`${base}/qr.png`} target="_blank" rel="noreferrer" className={button}>QR code</a>
        <a href={`${base}/table-tent.pdf`} target="_blank" rel="noreferrer" className={button}>Table tent</a>
        <a href={`${base}/stickers.pdf`} target="_blank" rel="noreferrer" className={button}>Sticker sheet</a>
        <span className="text-[13px] text-dim">
          {v.hosp ? 'Tents on the tables, stickers at the bar and on the check presenters.' : 'Tents at the front desk, stickers on the checkout sheet.'}
        </span>
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="-ml-px -mt-px border-l border-t border-border px-5 py-5 last:col-span-2 sm:last:col-span-1">
      <div className="figure text-[30px] font-bold leading-none">{value}</div>
      <div className="mt-2 text-xs text-dim">{label}</div>
    </div>
  );
}

function ZoneHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-serif text-[19px] font-bold">{title}</h2>
      <span className="text-xs text-dim">{note}</span>
    </div>
  );
}

function Table({ head, children, wide }: { head: string[]; children: ReactNode; wide?: boolean }) {
  return (
    <table className={`w-full text-left text-[13px] ${wide ? 'min-w-[760px]' : ''}`}>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="border-b border-border px-2 pb-2.5 text-xs font-medium text-dim">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-border px-2 py-2.5 align-top ${className}`}>{children}</td>;
}
