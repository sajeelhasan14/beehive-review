import { Suspense, type CSSProperties, type ReactNode } from 'react';
import { getDashboard, type DashboardData, type Guest } from '@/lib/data/dashboard';
import type { ClientSummary, CurrentUser } from '@/lib/auth/dal';
import { AppHeader } from '@/app/ui/app-header';
import { requestUpgrade, resolveAlert } from './actions';

// Client dashboard: /d/kyma. Only Kyma's own logins (and admins) get past requireClientAccess.
// Layout and wording follow renderClientDash() / renderWall() in Mario's demo.
export default function ClientDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-20 pt-6">
      <Suspense fallback={<p className="text-dim">Loading…</p>}>
        <Dashboard params={params} />
      </Suspense>
    </div>
  );
}

const TIERS = { 1: 'Capture', 2: 'Command', 3: 'Revenue' } as const;
const COMMAND_PRICE = { hospitality: '$499/mo', dental: '$999/mo' } as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const button = 'rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-xs font-medium hover:border-dim';
const zone = 'rounded-xl border border-border bg-surface p-5';
const pill = 'rounded-full border border-border px-2 py-0.5 text-[11px] text-dim';

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
    <div style={{ '--brand': client.brand_color } as CSSProperties}>
      <AppHeader
        title={client.name}
        subtitle={`Beehive Reviews · Tier ${client.tier} ${TIERS[client.tier]} · ${hosp ? 'Hospitality' : 'Dental'}`}
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
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="max-w-md">
        <h2 className="mb-2 text-2xl font-bold">Your dashboard is not included in your current plan.</h2>
        <p className="mb-5 text-dim">
          You are on Tier {client.tier}, {TIERS[client.tier]}. Your funnel is live and every {client.vertical === 'dental' ? 'patient' : 'customer'} is
          being saved. Upgrade to Command to see your numbers, get unhappy alerts, and turn on birthday texts.
        </p>
        {requested ? (
          <p className="text-ok">Upgrade requested. EMRG will be in touch shortly.</p>
        ) : (
          <form action={requestUpgrade.bind(null, client.slug)}>
            <button type="submit" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#111]" style={{ background: client.brand_color }}>
              Upgrade to Command, {COMMAND_PRICE[client.vertical]}
            </button>
          </form>
        )}
        {user.role === 'admin' && (
          <p className="mt-4 text-xs text-dim">Admin view: turn the dashboard on from the client card to see it.</p>
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
        { on: t >= 2, h: 'Save the sale alerts', p: t >= 2 ? 'Owner is texted within 60 seconds of any unhappy rating.' : `Off. Turn on to catch ${stats.unhappy} unhappy customers before they hit Google.` },
        { on: t >= 2, h: 'Birthday texts', p: t >= 2 ? `${plural(data.birthdays.length, 'birthday')} this month, texts fire automatically at 10 AM.` : `Off. Turn on to reach ${plural(data.birthdays.length, 'birthday')} this month.` },
        { on: t >= 3, h: 'Win back texts', p: t >= 3 ? 'Customers gone 30, 60, 90 days get an offer automatically.' : `Off. Turn on to reach ${stats.customers} past customers.` },
        { on: t >= 3, h: 'Slow night and VIP blasts', p: t >= 3 ? 'One tap sends an offer to your whole list.' : 'Off. Included in Revenue tier.' },
      ]
    : [
        { on: t >= 2, h: 'Save the patient alerts', p: t >= 2 ? 'Office manager is texted within 60 seconds of any unhappy rating.' : `Off. Turn on to catch ${stats.unhappy} unhappy patients before they post.` },
        { on: t >= 2, h: 'Recall and birthday texts', p: t >= 2 ? '6 month recall reminders and birthday texts fire automatically.' : `Off. Turn on to reach ${stats.customers} patients.` },
        { on: t >= 2, h: 'AI review replies', p: t >= 2 ? 'New Google reviews get a drafted reply in your voice. You tap send.' : 'Off. Included in Command tier.' },
        { on: t >= 3, h: 'Reactivation campaigns', p: t >= 3 ? 'Patients not seen in 12 months get a reactivation offer.' : 'Off. Turn on to reach lapsed patients.' },
      ];

  const moneyNote = data.estimate
    ? `Counts only ${unit} this month from ${people} the system already had on file, times your average ${hosp ? 'ticket' : 'visit'} of ${money(data.avgTicket)}. Nothing projected, nothing promised.`
    : `Nothing counted yet. This number only moves when a ${hosp ? 'customer' : 'patient'} this system reached comes back. ${t >= 3 ? 'Give the texts 30 days.' : 'Turn on win back to start.'}`;

  const max = Math.max(1, ...stats.ratings);
  const side = hosp ? data.birthdays : data.recall;

  return (
    <>
      <section className="mb-[18px] flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-br from-surface to-surface2 p-6">
        <div>
          <div className="mb-2 text-xs uppercase tracking-[.14em] text-dim">This month, estimated</div>
          <div className="text-[40px] font-extrabold leading-none text-[var(--brand)]">{money(data.estimate)}</div>
          <p className="mt-2 max-w-[520px] text-xs text-dim">{moneyNote}</p>
        </div>
        <div className="text-right">
          <div className="mb-2 text-xs uppercase tracking-[.14em] text-dim">Returning {unit}</div>
          <div className="text-[28px] font-extrabold leading-none text-[var(--brand)]">{stats.returning_this_month}</div>
        </div>
      </section>

      <section className="mb-[18px] grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label={hosp ? 'Customers' : 'Patients'} value={stats.customers} />
        <Stat label="Reviews generated" value={stats.reviews} />
        <Stat label="Avg rating" value={stats.avg_rating ?? '—'} />
        <Stat
          label={hosp ? 'Birthdays this month' : 'Alerts handled'}
          value={hosp ? data.birthdays.length : `${stats.resolved}/${stats.unhappy}`}
        />
        <Stat label="Unhappy caught" value={stats.unhappy} />
      </section>

      <section className="mb-[18px] grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {autos.map((a) => (
          <div key={a.h} className="rounded-xl border border-border bg-surface p-4">
            <div className={`text-[11px] font-bold uppercase tracking-[.1em] ${a.on ? 'text-ok' : 'text-warn'}`}>{a.on ? 'On' : 'Off'}</div>
            <h4 className="mb-1 mt-1.5 text-sm font-semibold">{a.h}</h4>
            <p className="text-xs text-dim">{a.p}</p>
          </div>
        ))}
      </section>

      {data.alerts.length > 0 && (
        <section className={`${zone} mb-[18px] border-alert`}>
          <ZoneHead title={hosp ? 'Unhappy customers to call back' : 'Unhappy patients to call back'} note={`${data.alerts.length} open`} />
          <div className="grid gap-2.5">
            {data.alerts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface2 p-3">
                <div>
                  <b>{a.first_name || 'Anonymous'}</b> <span className="text-brand">{stars(a.rating)}</span>
                  <div className="text-xs text-dim">{phone(a.phone) || 'no phone'} · {date(a.created_at)}</div>
                  {a.feedback_text && <p className="mt-1 text-[13px]">“{a.feedback_text}”</p>}
                </div>
                <form action={resolveAlert.bind(null, a.id)}>
                  <button type="submit" className={button}>Mark resolved</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <div className={zone}>
          <ZoneHead title="Rating breakdown" note={`${stats.ratings.reduce((a, b) => a + b, 0)} total`} />
          <div className="grid gap-2">
            {[5, 4, 3, 2, 1].map((r, i) => (
              <div key={r} className="grid grid-cols-[40px_1fr_36px] items-center gap-2.5 text-xs">
                <span>★ {r}</span>
                <div className="h-2 overflow-hidden rounded-full bg-surface2">
                  <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(stats.ratings[i] / max) * 100}%` }} />
                </div>
                <span className="text-right">{stats.ratings[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={zone}>
          <ZoneHead
            title={hosp ? 'Birthday engine' : 'Recall list'}
            note={hosp ? `${data.birthdays.length} this month` : `${stats.customers} patients`}
          />
          {side.length ? (
            <Table head={['Name', hosp ? 'Birthday' : 'Last visit', ...(hosp ? [] : ['Recall due']), 'Phone']}>
              {side.map((g) => (
                <tr key={g.id}>
                  <Td>{g.first_name}</Td>
                  <Td>{hosp ? birthday(g) : date(g.last_seen_at)}</Td>
                  {!hosp && <Td>{date(recallDue(g))}</Td>}
                  <Td>{phone(g.phone)}</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="py-4 text-center text-dim">{hosp ? 'No birthdays this month yet.' : 'No patients yet.'}</p>
          )}
        </div>
      </section>

      <section className={zone}>
        <ZoneHead title={hosp ? 'Guest list' : 'Patient list'} note={`Only ${client.name} data. Nobody else can see this.`} />
        {data.guests.length ? (
          <div className="overflow-x-auto">
            <Table head={['Name', 'Phone', 'Birthday', 'Rating', 'Visits', 'Feedback', 'Last seen']}>
              {data.guests.map((g) => (
                <tr key={g.id}>
                  <Td>{[g.first_name, g.last_name].filter(Boolean).join(' ')}</Td>
                  <Td>{phone(g.phone)}</Td>
                  <Td>{birthday(g)}</Td>
                  <Td className="text-brand">{stars(g.last_rating)}</Td>
                  <Td>{g.visits}</Td>
                  <Td>{g.last_feedback}</Td>
                  <Td>{date(g.last_seen_at)}</Td>
                </tr>
              ))}
            </Table>
          </div>
        ) : (
          <p className="py-4 text-center text-dim">Nothing yet. Scan your QR code and submit a test.</p>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <div className="text-xs text-dim">{label}</div>
      <div className="mt-0.5 text-[26px] font-bold text-[var(--brand)]">{value}</div>
    </div>
  );
}

function ZoneHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <span className={pill}>{note}</span>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <table className="w-full text-left text-[13px]">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="border-b border-border px-2 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-dim">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-border px-2 py-2 align-top ${className}`}>{children}</td>;
}
