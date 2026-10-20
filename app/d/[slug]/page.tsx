import { Suspense, type CSSProperties, type ReactNode } from 'react';
import { getDashboard, type DashboardData, type Guest } from '@/lib/data/dashboard';
import type { ClientSummary, CurrentUser } from '@/lib/auth/dal';
import { AppHeader, headerButton as button } from '@/app/ui/app-header';
import { requestUpgrade, resolveAlert } from './actions';

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

  return (
    <div style={{ '--client': client.brand_color } as CSSProperties}>
      <AppHeader
        title={client.name}
        subtitle={`${hosp ? 'Hospitality' : 'Dental'}, Tier ${client.tier} ${TIERS[client.tier]}`}
        userName={user.name}
        mark={client.brand_color}
      >
        {user.role === 'admin' && <a href="/admin" className={button}>Back to admin</a>}
        {data && <a href={`/d/${client.slug}/contacts.csv`} className={button}>Download my sheet</a>}
      </AppHeader>
      {data ? <Full client={client} data={data} /> : <Wall client={client} user={user} />}
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

function Full({ client, data }: { client: ClientSummary; data: DashboardData }) {
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

  const max = Math.max(1, ...stats.ratings);
  const side = hosp ? data.birthdays : data.recall;

  return (
    <>
      <section className="mb-10 grid gap-6 border-b border-border pb-10 md:grid-cols-[auto_1fr] md:items-end md:gap-12">
        <div>
          <p className="mb-3 text-[13px] text-dim">Brought back this month, estimated</p>
          <p className="figure text-[64px] font-bold leading-[.9] sm:text-[80px]">{money(data.estimate)}</p>
        </div>
        <div className="max-w-[460px] md:pb-2">
          <p className="mb-2 text-[15px]">
            <span className="figure text-[22px] font-bold">{stats.returning_this_month}</span>{' '}
            returning {stats.returning_this_month === 1 ? unit.slice(0, -1) : unit}
          </p>
          <p className="text-[13px] leading-relaxed text-dim">{moneyNote}</p>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-surface sm:grid-cols-3 lg:grid-cols-5">
        <Figure label={hosp ? 'Customers' : 'Patients'} value={stats.customers} />
        <Figure label="Sent to Google" value={stats.reviews} />
        <Figure label="Average rating" value={stats.avg_rating ?? '—'} />
        <Figure
          label={hosp ? 'Birthdays this month' : 'Alerts handled'}
          value={hosp ? data.birthdays.length : `${stats.resolved}/${stats.unhappy}`}
        />
        <Figure label="Unhappy caught" value={stats.unhappy} />
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-serif text-[19px] font-bold">Automations</h2>
        <div className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
          {autos.map((a) => (
            <div key={a.h} className="flex gap-3">
              <span
                aria-hidden
                className={`mt-[5px] size-2.5 shrink-0 rounded-full ${a.on ? 'bg-ok' : 'border border-dim'}`}
              />
              <div>
                <h3 className="text-[14px] font-semibold">
                  {a.h} <span className={`ml-1 text-xs font-medium ${a.on ? 'text-ok' : 'text-dim'}`}>{a.on ? 'On' : 'Off'}</span>
                </h3>
                <p className="mt-0.5 text-[13px] leading-relaxed text-dim">{a.p}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.alerts.length > 0 && (
        <section className={`${zone} mb-6 border-alert/50 shadow-[inset_3px_0_0_var(--color-alert)]`}>
          <ZoneHead title={hosp ? 'Unhappy customers to call back' : 'Unhappy patients to call back'} note={`${data.alerts.length} open`} />
          <ul className="divide-y divide-border">
            {data.alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                <div>
                  <span className="font-medium">{a.first_name || 'Anonymous'}</span>{' '}
                  <span className="ml-1 text-brand" aria-label={`${a.rating} out of 5`}>{stars(a.rating)}</span>
                  <div className="mt-0.5 text-xs text-dim">{phone(a.phone) || 'No phone left'}, {date(a.created_at)}</div>
                  {a.feedback_text && <p className="mt-1.5 max-w-[65ch] font-serif text-[14px] leading-relaxed">“{a.feedback_text}”</p>}
                </div>
                <form action={resolveAlert.bind(null, a.id)}>
                  <button type="submit" className={button}>Mark resolved</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={zone}>
          <ZoneHead title="Ratings" note={`${stats.ratings.reduce((a, b) => a + b, 0)} total`} />
          <div className="grid gap-2.5">
            {[5, 4, 3, 2, 1].map((r, i) => (
              <div key={r} className="grid grid-cols-[44px_1fr_32px] items-center gap-3 text-[13px]">
                <span className="text-dim">{r} star</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                  <div className="h-full rounded-full bg-[var(--client)]" style={{ width: `${(stats.ratings[i] / max) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums">{stats.ratings[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={zone}>
          <ZoneHead
            title={hosp ? 'Birthdays this month' : 'Recall list'}
            note={hosp ? plural(data.birthdays.length, 'guest') : plural(stats.customers, 'patient')}
          />
          {side.length ? (
            <Table head={['Name', hosp ? 'Birthday' : 'Last visit', ...(hosp ? [] : ['Recall due']), 'Phone']}>
              {side.map((g) => (
                <tr key={g.id}>
                  <Td>{g.first_name}</Td>
                  <Td>{hosp ? birthday(g) : date(g.last_seen_at)}</Td>
                  {!hosp && <Td>{date(recallDue(g))}</Td>}
                  <Td className="whitespace-nowrap tabular-nums">{phone(g.phone)}</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-dim">
              {hosp ? 'No birthdays this month yet. Guests add theirs when they rate you.' : 'No patients yet. They appear after their first rating.'}
            </p>
          )}
        </div>
      </section>

      <section className={zone}>
        <ZoneHead title={hosp ? 'Guest list' : 'Patient list'} note={`Only ${client.name} can see this`} />
        {data.guests.length ? (
          <div className="-mx-2 overflow-x-auto">
            <Table wide head={['Name', 'Phone', 'Birthday', 'Rating', 'Visits', 'Feedback', 'Last seen']}>
              {data.guests.map((g) => (
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
    </>
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
