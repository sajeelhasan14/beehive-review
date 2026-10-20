import 'server-only';
import { createSign } from 'node:crypto';
import { db } from '@/lib/db';

// Google Sheet per client: the client's window on their contacts. Postgres stays the engine;
// a sheet failure never blocks a funnel submission, it's only recorded on clients.sheet_error.
//
// Turned on by GOOGLE_SERVICE_ACCOUNT_JSON (the key file's JSON, raw or base64). Optional:
//   GOOGLE_DRIVE_FOLDER_ID   create sheets inside this folder (use a Shared Drive folder the service
//                            account is a member of: service accounts have no Drive storage of their own)
//   GOOGLE_SHEETS_SHARE_WITH comma separated emails (ops) that get edit access to every new sheet

const HEADER = ['Date', 'Rating', 'Path', 'First name', 'Last name', 'Phone', 'Email', 'Birthday', 'SMS consent', 'Feedback', 'Returning'];

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const json = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    return json.client_email && json.private_key ? json : null;
  } catch {
    return null;
  }
}

export function sheetsEnabled(): boolean {
  return serviceAccount() !== null;
}

// ---------- Google auth: a signed JWT swapped for a 1 hour access token (no googleapis package) ----------

let token: { value: string; expires: number } | undefined;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;

  const now = Math.floor(Date.now() / 1000);
  const encode = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google sign in failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return token.value;
}

async function google<T>(url: string, init: { method: string; body?: unknown }): Promise<T> {
  const sa = serviceAccount();
  if (!sa) throw new Error('Google Sheets is not configured');
  const res = await fetch(url, {
    method: init.method,
    headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`Google API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

// ---------- Sheet operations ----------

async function createSheet(title: string): Promise<string> {
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  const id = folder
    ? (await google<{ id: string }>('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
        method: 'POST',
        body: { name: title, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [folder] },
      })).id
    : (await google<{ spreadsheetId: string }>('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        body: { properties: { title } },
      })).spreadsheetId;

  await google(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/A1:K1?valueInputOption=RAW`, {
    method: 'PUT',
    body: { values: [HEADER] },
  });

  const shareWith = (process.env.GOOGLE_SHEETS_SHARE_WITH ?? '').split(',').map((e) => e.trim()).filter(Boolean);
  for (const email of shareWith) {
    await google(
      `https://www.googleapis.com/drive/v3/files/${id}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
      { method: 'POST', body: { type: 'user', role: 'writer', emailAddress: email } },
    );
  }
  return id;
}

// RAW input: whatever a customer typed is stored as text, never run as a formula.
async function appendRow(sheetId: string, row: (string | number)[]): Promise<void> {
  await google(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: { values: [row] } },
  );
}

async function recordError(clientId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Google Sheet sync failed for client ${clientId}:`, message);
  await db().query('update clients set sheet_error = $2 where id = $1', [clientId, message.slice(0, 500)]);
}

// Creates the client's sheet if it doesn't have one yet. Returns the sheet id, or null if Sheets
// is off or it failed (the error is saved on the client so the admin card can show it).
export async function ensureClientSheet(clientId: string): Promise<string | null> {
  if (!sheetsEnabled()) return null;
  const { rows: [client] } = await db().query<{ name: string; google_sheet_id: string | null }>(
    'select name, google_sheet_id from clients where id = $1',
    [clientId],
  );
  if (!client) return null;
  if (client.google_sheet_id) return client.google_sheet_id;

  try {
    const id = await createSheet(`${client.name} · Beehive contacts`);
    await db().query('update clients set google_sheet_id = $2, sheet_error = null where id = $1', [clientId, id]);
    return id;
  } catch (err) {
    await recordError(clientId, err);
    return null;
  }
}

export interface SheetSubmission {
  rating: number;
  path: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  sms_consent: boolean;
  feedback_text: string | null;
  returning_visitor: boolean;
}

// Called after a funnel submission is saved (in after(), so the customer never waits on Google).
export async function syncSubmission(funnelSlug: string, s: SheetSubmission): Promise<void> {
  if (!sheetsEnabled()) return;
  const { rows: [funnel] } = await db().query<{ client_id: string }>('select client_id from funnels where slug = $1', [funnelSlug]);
  if (!funnel) return;

  const sheetId = await ensureClientSheet(funnel.client_id);
  if (!sheetId) return;
  try {
    await appendRow(sheetId, [
      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
      s.rating,
      s.path,
      s.first_name ?? '',
      s.last_name ?? '',
      s.phone ?? '',
      s.email ?? '',
      s.birthday_month && s.birthday_day ? `${s.birthday_month}/${s.birthday_day}` : '',
      s.sms_consent ? 'yes' : 'no',
      s.feedback_text ?? '',
      s.returning_visitor ? 'yes' : 'no',
    ]);
    await db().query('update clients set sheet_error = null where id = $1 and sheet_error is not null', [funnel.client_id]);
  } catch (err) {
    await recordError(funnel.client_id, err);
  }
}

export function sheetUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}
