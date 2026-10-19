import type { ClientCard as Card } from '@/lib/data/admin';
import { sheetUrl } from '@/lib/sheets';
import { publishFunnel, retrySheet } from './actions';
import { AddLogin } from './add-login';
import { ClientControls } from './client-controls';
import { CopyPackage } from './copy-package';

const TIERS = { 1: 'Capture', 2: 'Command', 3: 'Revenue' } as const;

const button = 'rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:border-dim';
const pill = 'rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.08em]';

// One client in the admin grid (layout from the demo's .card). Red border = unhappy customers waiting.
export function ClientCard({ client, baseUrl, sheets }: { client: Card; baseUrl: string; sheets: boolean }) {
  const attention = client.open_alerts > 0;
  const kit = `/admin/kit/${client.slug}`;

  return (
    <div className={`rounded-xl border bg-surface2 p-4 ${attention ? 'border-alert' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <span className={`inline-block size-2 shrink-0 rounded-full ${attention ? 'bg-alert' : 'bg-ok'}`} />
            {client.name}
          </h3>
          <div className="mt-0.5 font-mono text-xs text-dim">
            {client.funnel_slug ? `/c/${client.funnel_slug}` : 'No funnel yet'}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <span className={`${pill} text-text`}>{client.vertical}</span>
          <span className={`${pill} text-dim`}>T{client.tier} {TIERS[client.tier]}</span>
          {client.funnel_status && client.funnel_status !== 'live' && (
            <span className={`${pill} border-warn text-warn`}>{client.funnel_status}</span>
          )}
          {client.status === 'paused' && <span className={`${pill} border-warn text-warn`}>paused</span>}
          {client.upgrade_requested_at && <span className={`${pill} border-ok text-ok`}>upgrade requested</span>}
        </div>
      </div>

      <div className="mb-0.5 mt-3 flex gap-[18px]">
        <Count value={client.contacts} label="contacts" />
        <Count value={client.reviews} label="to review" />
        <Count value={client.open_alerts} label="alerts" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
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
        <a href={`/d/${client.slug}`} className={button}>
          {client.dashboard_enabled ? 'Client dashboard' : 'Dashboard (off)'}
        </a>
        <CopyPackage text={packageText(client, baseUrl)} className={button} />
        <a href={`/d/${client.slug}/contacts.csv`} className={button}>
          Sheet (CSV)
        </a>
      </div>

      {client.funnel_slug && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-dim">
          Print kit:
          <a href={`${kit}/qr.png`} target="_blank" rel="noreferrer" className="text-text underline-offset-2 hover:underline">QR code</a>·
          <a href={`${kit}/table-tent.pdf`} target="_blank" rel="noreferrer" className="text-text underline-offset-2 hover:underline">Table tent</a>·
          <a href={`${kit}/stickers.pdf`} target="_blank" rel="noreferrer" className="text-text underline-offset-2 hover:underline">Stickers</a>
        </div>
      )}

      {sheets && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-dim">
          Google Sheet:
          {client.google_sheet_id ? (
            <a href={sheetUrl(client.google_sheet_id)} target="_blank" rel="noreferrer" className="text-text underline-offset-2 hover:underline">
              Open
            </a>
          ) : (
            <span>{client.sheet_error ? 'not created' : 'being created…'}</span>
          )}
          {client.sheet_error && (
            <>
              <span className="text-alert" title={client.sheet_error}>sync error</span>
              <form action={retrySheet.bind(null, client.id)}>
                <button type="submit" className="text-text underline underline-offset-2">Retry</button>
              </form>
            </>
          )}
        </div>
      )}

      <ClientControls clientId={client.id} tier={client.tier} dashboard={client.dashboard_enabled} />

      <p className="mt-2 text-xs text-dim">
        Login: <span className="text-text">{client.logins ?? 'none yet'}</span>
      </p>
      {!client.logins && <AddLogin clientId={client.id} />}
    </div>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <b className="block text-[22px] font-bold">{value}</b>
      <span className="text-[11px] text-dim">{label}</span>
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
