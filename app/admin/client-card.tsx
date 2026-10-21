import type { ClientCard as Card } from '@/lib/data/admin';
import { sheetUrl } from '@/lib/sheets';
import { publishFunnel, retrySheet } from './actions';
import { AddLogin } from './add-login';
import { ClientControls } from './client-controls';
import { CopyPackage } from './copy-package';

const TIERS = { 1: 'Capture', 2: 'Command', 3: 'Revenue' } as const;

const button = 'rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-dim';
const primary = 'rounded-lg border border-text bg-text px-3 py-1.5 text-xs font-medium text-bg hover:opacity-90';
const tag = 'rounded-full px-2 py-0.5 text-[11px] font-medium';
const link = 'text-text underline decoration-border underline-offset-[3px] hover:decoration-text';

// One client in the admin grid (layout from the demo's .card). Red edge = unhappy customers waiting.
export function ClientCard({ client, baseUrl, sheets }: { client: Card; baseUrl: string; sheets: boolean }) {
  const attention = client.open_alerts > 0;
  const kit = `/admin/kit/${client.slug}`;
  const vertical = client.vertical === 'dental' ? 'Dental' : 'Hospitality';

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl border bg-surface ${
        attention ? 'border-alert/60 shadow-[inset_3px_0_0_var(--color-alert)]' : 'border-border'
      }`}
    >
      <div className="flex-1 px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-[18px] font-bold leading-snug">{client.name}</h3>
            <p className="mt-0.5 text-xs text-dim">
              {vertical}, Tier {client.tier} {TIERS[client.tier]}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {client.funnel_status && client.funnel_status !== 'live' && (
              <span className={`${tag} bg-warn/10 text-warn`}>{client.funnel_status === 'draft' ? 'Draft' : 'Paused'}</span>
            )}
            {client.status === 'paused' && <span className={`${tag} bg-warn/10 text-warn`}>Account paused</span>}
            {client.upgrade_requested_at && <span className={`${tag} bg-ok/10 text-ok`}>Wants to upgrade</span>}
            {client.dashboard_sample && <span className={`${tag} bg-warn/10 text-warn`}>Sample data</span>}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 border-y border-border py-3.5">
          <Count value={client.contacts} label="Contacts" />
          <Count value={client.reviews} label="Sent to Google" />
          <Count value={client.open_alerts} label="Open alerts" alert={attention} />
        </dl>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <a href={`/d/${client.slug}`} className={client.dashboard_enabled ? primary : button}>
            {client.dashboard_enabled ? 'Client dashboard' : 'Dashboard (off)'}
          </a>
          {client.funnel_slug && client.funnel_status === 'live' && (
            <a href={`/c/${client.funnel_slug}`} target="_blank" rel="noreferrer" className={button}>
              Open funnel
            </a>
          )}
          {client.funnel_id && client.funnel_status !== 'live' && (
            <>
              <a href={`/admin/preview/${client.funnel_slug}`} target="_blank" rel="noreferrer" className={button}>
                Preview
              </a>
              <form action={publishFunnel.bind(null, client.funnel_id)}>
                <button type="submit" className={`${button} border-ok text-ok`}>
                  Publish
                </button>
              </form>
            </>
          )}
          {client.funnel_slug && (
            <a href={`/admin/funnel/${client.funnel_slug}`} className={button}>
              Customize page
            </a>
          )}
          <CopyPackage text={packageText(client, baseUrl)} className={button} />
        </div>

        <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
          {client.funnel_slug && (
            <span className="flex flex-wrap gap-x-3">
              Print
              <a href={`${kit}/qr.png`} target="_blank" rel="noreferrer" className={link}>QR code</a>
              <a href={`${kit}/table-tent.pdf`} target="_blank" rel="noreferrer" className={link}>Table tent</a>
              <a href={`${kit}/stickers.pdf`} target="_blank" rel="noreferrer" className={link}>Stickers</a>
            </span>
          )}
          <span className="flex flex-wrap gap-x-3">
            Data
            <a href={`/d/${client.slug}/contacts.csv`} className={link}>CSV</a>
            {sheets && client.google_sheet_id && (
              <a href={sheetUrl(client.google_sheet_id)} target="_blank" rel="noreferrer" className={link}>Google Sheet</a>
            )}
            {sheets && !client.google_sheet_id && !client.sheet_error && <span>Sheet being created</span>}
          </span>
        </div>
        {sheets && client.sheet_error && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-alert">
            <span title={client.sheet_error}>Google Sheet sync failed.</span>
            <form action={retrySheet.bind(null, client.id)}>
              <button type="submit" className="font-medium underline underline-offset-2">Try again</button>
            </form>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-border bg-surface2 px-5 py-3.5">
        <ClientControls clientId={client.id} tier={client.tier} dashboard={client.dashboard_enabled} />
        <p className="mt-2.5 truncate text-xs text-dim">
          Login <span className="text-text">{client.logins ?? 'none yet'}</span>
        </p>
        {!client.logins && <AddLogin clientId={client.id} />}
      </div>
    </article>
  );
}

function Count({ value, label, alert }: { value: number; label: string; alert?: boolean }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-1 text-[11px] text-dim">{label}</dt>
      <dd className={`figure text-[24px] font-bold leading-none ${alert ? 'text-alert' : ''}`}>{value}</dd>
    </div>
  );
}

// What Mario pastes to a new client. Passwords are never stored, so the login line names the email only.
function packageText(c: Card, base: string): string {
  return [
    `${c.name}, your Beehive package:`,
    c.funnel_slug && `Funnel (on your QR code): ${base}/c/${c.funnel_slug}`,
    `Review page: ${c.review_link}`,
    c.dashboard_enabled && `Your dashboard: ${base}/d/${c.slug}`,
    c.dashboard_enabled && c.logins && `Login: ${c.logins} (password sent separately)`,
    c.google_sheet_id && `Your contact sheet: ${sheetUrl(c.google_sheet_id)}`,
  ]
    .filter(Boolean)
    .join('\n');
}
