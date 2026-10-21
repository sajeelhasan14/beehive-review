'use server';

import { refresh } from 'next/cache';
import { after } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/dal';
import { createLogin } from '@/lib/auth/users';
import { aiSmartFill, type SmartFields } from '@/lib/ai/smart-fill';
import { ensureClientSheet } from '@/lib/sheets';
import { readWebsite, type WebsiteLook } from '@/lib/brand/read-website';
import { searchPlaces, type GooglePlace } from '@/lib/google/places';
import { FONT_PAIRINGS, THEMES, type CopySlots, type FontPairing, type FunnelStyle, type Template } from '@/lib/funnel/render';

// Server Actions are public endpoints under the hood: always re-check admin and validate input.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Trimmed form field cut to max length. Empty -> null.
function field(formData: FormData, name: string, max: number): string | null {
  const value = String(formData.get(name) ?? '').trim().slice(0, max);
  return value || null;
}

// "Figlia & Sons" -> "figlia-sons" (same as the demo's kebab()).
function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isUniqueViolation(err: unknown): err is { code: string; constraint?: string } {
  return (err as { code?: string }).code === '23505';
}

// ---------- Tier and dashboard switches (Part 5a) ----------

// Same rule as the demo: Tier 1 has no dashboard, Tier 2 and 3 include it.
export async function setTier(clientId: string, tier: number): Promise<void> {
  await requireAdmin();
  if (!UUID.test(clientId) || ![1, 2, 3].includes(tier)) throw new Error('Invalid tier change');
  await db().query(
    'update clients set tier = $2, dashboard_enabled = $3, upgrade_requested_at = null where id = $1',
    [clientId, tier, tier >= 2],
  );
  refresh();
}

// The upsell switch: turn a client's dashboard on or off without changing tier.
export async function setDashboard(clientId: string, enabled: boolean): Promise<void> {
  await requireAdmin();
  if (!UUID.test(clientId) || typeof enabled !== 'boolean') throw new Error('Invalid dashboard change');
  await db().query(
    `update clients set dashboard_enabled = $2,
            upgrade_requested_at = case when $2 then null else upgrade_requested_at end
      where id = $1`,
    [clientId, enabled],
  );
  refresh();
}

// ---------- Dashboard look (admin bar on /d/{slug}) ----------

export interface DashboardLook {
  theme: 'light' | 'dark';
  style: 'classic' | 'spotlight' | 'tiles';
  sample: boolean;
}

// Light or dark, the layout, and sample data for demos. EMRG decides these, never the client.
export async function setDashboardLook(clientId: string, look: DashboardLook): Promise<void> {
  await requireAdmin();
  if (!UUID.test(clientId) || !look || typeof look.sample !== 'boolean') throw new Error('Invalid dashboard look');
  await db().query(
    'update clients set dashboard_theme = $2, dashboard_style = $3, dashboard_sample = $4 where id = $1',
    [clientId, pick(look.theme, ['light', 'dark'], 'light'), pick(look.style, ['classic', 'spotlight', 'tiles'], 'classic'), look.sample],
  );
  refresh();
}

// ---------- Add client (Part 5b) ----------

// Funnel look and wording per vertical, from the demo's funnelObj().
const VERTICAL_DEFAULTS = {
  hospitality: {
    ticket: 60,
    template: 'midnight',
    font: 'classic',
    accent: '#1A1815',
    question: 'How was your visit?',
    unhappy: null,
    slots: {},
  },
  dental: {
    ticket: 400,
    template: 'ivory',
    font: 'editorial',
    accent: '#1B4965',
    question: 'How was your visit today?',
    unhappy: 'Thank you for sharing. Our office manager will follow up with you personally.',
    slots: {
      club_headline: 'Join our patient perks list',
      club_sub: 'Leave your info for reminders, offers, and a birthday surprise.',
      reassure: 'Your comfort is everything to us. Every review is read by the doctor and the team.',
    },
  },
} as const;

// The looks Add client may pick (from the website or by hand). Matches the funnels table checks.
const TEMPLATES = ['midnight', 'ivory', 'marquee'];
const FONTS = ['classic', 'modern', 'editorial', 'bold', 'quiet'];

export type NewLoginResult = { email: string; password: string };

export type CreateClientState =
  | { error: string }
  | { created: { name: string; slug: string; funnelId: string; funnelSlug: string; login: NewLoginResult | null } }
  | undefined;

export async function createClient(_previous: CreateClientState, formData: FormData): Promise<CreateClientState> {
  await requireAdmin();

  const name = field(formData, 'name', 80);
  const vertical = formData.get('vertical') === 'dental' ? 'dental' : 'hospitality';
  const reviewLink = field(formData, 'review_link', 500);
  const tier = Number(formData.get('tier'));
  const ticketText = field(formData, 'avg_ticket', 10);
  const color = field(formData, 'brand_color', 7) ?? '#E8B54D';
  const question = field(formData, 'rating_question', 140);
  // No name typed? The login still works; it's shown as "{Business} owner" until renamed.
  const ownerName = field(formData, 'owner_name', 80) ?? (name ? `${name} owner`.slice(0, 80) : null);
  const ownerEmail = field(formData, 'owner_email', 200)?.toLowerCase() ?? null;

  const website = field(formData, 'website', 500);
  const logoUrl = field(formData, 'logo_url', 1000);
  const fontPairing = String(formData.get('font_pairing') ?? '');
  const template = String(formData.get('template') ?? '');

  const defaults = VERTICAL_DEFAULTS[vertical];
  const slug = name ? toSlug(name) : '';
  const avgTicket = ticketText ? Number(ticketText) : defaults.ticket;

  if (!name || !slug) return { error: 'Business name is required.' };
  if (!reviewLink || !isHttpUrl(reviewLink)) return { error: 'Paste the client review link. It must start with https://' };
  if (![1, 2, 3].includes(tier)) return { error: 'Pick a tier.' };
  if (!Number.isFinite(avgTicket) || avgTicket < 0 || avgTicket > 100000) return { error: 'Average ticket must be a number.' };
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { error: 'Brand color must look like #E8B54D.' };
  if (website && !isHttpUrl(website)) return { error: 'The website must start with https://' };
  if (logoUrl && !isHttpUrl(logoUrl)) return { error: 'The logo must be a link starting with https://' };
  if (ownerEmail && !EMAIL.test(ownerEmail)) return { error: 'Owner email doesn’t look right.' };

  // One transaction: client + draft funnel + login all save, or none do.
  const tx = await db().connect();
  try {
    await tx.query('begin');
    const { rows: [client] } = await tx.query<{ id: string }>(
      `insert into clients (slug, name, vertical, tier, dashboard_enabled, avg_ticket, brand_color, review_link, website)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [slug, name, vertical, tier, tier >= 2, avgTicket, color, reviewLink, website],
    );
    const funnelSlug = `${slug}-review`;
    const { rows: [funnel] } = await tx.query<{ id: string }>(
      `insert into funnels (client_id, slug, template, font_pairing, brand_accent, logo_url, rating_question, unhappy_message, copy_slots, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft') returning id`,
      [client.id, funnelSlug, TEMPLATES.includes(template) ? template : defaults.template,
       FONTS.includes(fontPairing) ? fontPairing : defaults.font, defaults.accent, logoUrl, question ?? defaults.question,
       defaults.unhappy, JSON.stringify(defaults.slots)],
    );
    const password = ownerEmail && ownerName
      ? await createLogin(tx, { email: ownerEmail, name: ownerName, role: 'client', clientId: client.id })
      : null;
    await tx.query('commit');

    // The client's Google Sheet is made after the response (it talks to Google, a few seconds).
    after(() => ensureClientSheet(client.id));
    refresh();
    return {
      created: {
        name,
        slug,
        funnelId: funnel.id,
        funnelSlug,
        login: ownerEmail && password ? { email: ownerEmail, password } : null,
      },
    };
  } catch (err) {
    await tx.query('rollback');
    if (isUniqueViolation(err)) {
      return {
        error: err.constraint === 'users_email_key'
          ? `A login for ${ownerEmail} already exists.`
          : `A client called "${name}" already exists.`,
      };
    }
    throw err;
  } finally {
    tx.release();
  }
}

// Draft (or paused) funnel -> live at /c/{slug}.
export async function publishFunnel(funnelId: string): Promise<void> {
  await requireAdmin();
  if (!UUID.test(funnelId)) throw new Error('Invalid funnel');
  await db().query(`update funnels set status = 'live' where id = $1`, [funnelId]);
  refresh();
}

// ---------- Page editor (/admin/funnel/[slug]) ----------

// Everything the page editor saves in one go.
export interface FunnelDesign {
  template: Template;
  font_pairing: FontPairing;
  brand_color: string;
  logo_url: string | null;
  rating_question: string | null;
  unhappy_message: string | null;
  birthday_active: boolean;
  okay_routes_happy: boolean;
  copy_slots: CopySlots;
  style: FunnelStyle;
}

const COPY_KEYS: (keyof CopySlots)[] = [
  'rate_sub', 'reassure', 'club_headline', 'club_sub', 'cta', 'thanks', 'unhappy_headline', 'unhappy_sub', 'unhappy_cta',
];

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

// Trimmed text cut to max, or null when blank (blank = the page uses its default wording).
function words(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

export async function saveFunnelDesign(funnelId: string, design: FunnelDesign): Promise<{ error?: string }> {
  await requireAdmin();
  if (!UUID.test(funnelId) || !design || typeof design !== 'object') return { error: 'Invalid page.' };

  const color = String(design.brand_color ?? '');
  const logo = words(design.logo_url, 1000);
  const cover = words(design.style?.cover_url, 1000);
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { error: 'Brand color must look like #E8B54D.' };
  if (logo && !isHttpUrl(logo)) return { error: 'The logo must be a link starting with https://' };
  if (cover && !isHttpUrl(cover)) return { error: 'The cover photo must be a link starting with https://' };

  const s = design.style ?? {};
  const style: FunnelStyle = {
    header: pick(s.header, ['band', 'photo', 'simple'], 'band'),
    cover_url: cover,
    logo_shape: pick(s.logo_shape, ['auto', 'circle', 'square', 'wide'], 'auto'),
    rating_style: pick(s.rating_style, ['faces', 'stars', 'numbers'], 'faces'),
    corners: pick(s.corners, ['round', 'soft', 'square'], 'round'),
    background: pick(s.background, ['plain', 'tinted'], 'plain'),
    show_powered: s.show_powered !== false,
  };
  if (style.header === 'photo' && !cover) return { error: 'Add a cover photo link, or pick another header.' };

  const copy: CopySlots = {};
  for (const key of COPY_KEYS) {
    const value = words(design.copy_slots?.[key], 200);
    if (value) copy[key] = value;
  }

  const { rows: [funnel] } = await db().query<{ client_id: string }>(
    `update funnels set template = $2, font_pairing = $3, logo_url = $4, rating_question = $5, unhappy_message = $6,
            birthday_active = $7, okay_routes_happy = $8, copy_slots = $9, style = $10
      where id = $1 returning client_id`,
    [
      funnelId,
      pick(design.template, Object.keys(THEMES) as Template[], 'midnight'),
      pick(design.font_pairing, Object.keys(FONT_PAIRINGS) as FontPairing[], 'classic'),
      logo,
      words(design.rating_question, 140),
      words(design.unhappy_message, 300),
      design.birthday_active !== false,
      design.okay_routes_happy === true,
      JSON.stringify(copy),
      JSON.stringify(style),
    ],
  );
  if (!funnel) return { error: 'That page no longer exists.' };
  await db().query('update clients set brand_color = $2 where id = $1', [funnel.client_id, color]);
  refresh();
  return {};
}

// ---------- Add a login to an existing client ----------

export type AddLoginState = { error: string } | { login: NewLoginResult } | undefined;

export async function createClientLogin(clientId: string, _previous: AddLoginState, formData: FormData): Promise<AddLoginState> {
  await requireAdmin();
  const name = field(formData, 'name', 80);
  const email = field(formData, 'email', 200)?.toLowerCase() ?? null;

  if (!UUID.test(clientId)) return { error: 'Unknown client.' };
  if (!name) return { error: 'Add their name.' };
  if (!email || !EMAIL.test(email)) return { error: 'Add a valid email.' };

  try {
    const password = await createLogin(db(), { email, name, role: 'client', clientId });
    refresh();
    return { login: { email, password } };
  } catch (err) {
    if (isUniqueViolation(err)) return { error: `A login for ${email} already exists.` };
    throw err;
  }
}

// ---------- AI smart fill ----------

// null = no AI available (no key, refusal or error): the form falls back to the instant pattern fill.
export async function smartFillWithAi(description: string): Promise<SmartFields | null> {
  await requireAdmin();
  const text = String(description ?? '').trim().slice(0, 2000);
  if (!text) return null;
  try {
    return await aiSmartFill(text);
  } catch (err) {
    console.error('AI smart fill failed:', err);
    return null;
  }
}

// ---------- Google Sheet ----------

// "Retry sheet" on a client card: creates the sheet if the first try failed.
export async function retrySheet(clientId: string): Promise<void> {
  await requireAdmin();
  if (!UUID.test(clientId)) throw new Error('Invalid client');
  await db().query('update clients set sheet_error = null where id = $1', [clientId]);
  await ensureClientSheet(clientId);
  refresh();
}

// ---------- Their website ----------

export type WebsiteResult =
  | { error: string }
  | { look: WebsiteLook; fields: Partial<SmartFields> & { vertical?: 'hospitality' | 'dental' }; ai: boolean };

// Reads the client's site for their look, then runs the smart fill on its words for name, type and question.
export async function readClientWebsite(url: string): Promise<WebsiteResult> {
  await requireAdmin();
  let look: WebsiteLook;
  try {
    look = await readWebsite(String(url ?? '').slice(0, 500));
  } catch (err) {
    const text = err instanceof Error ? err.message : '';
    const message = /timeout|aborted/i.test(text)
      ? 'That website didn’t answer in time. Try again, or fill the form by hand.'
      : /fetch failed/i.test(text)
        ? 'Couldn’t connect to that website. Check the address (try it in your browser), or fill the form by hand.'
        : text || 'Couldn’t read that website. Fill the form by hand.';
    return { error: message };
  }

  let ai: SmartFields | null = null;
  try {
    ai = await aiSmartFill(`Website: ${look.website}\n${look.name ? `Name: ${look.name}\n` : ''}${look.text}`);
  } catch (err) {
    console.error('AI smart fill (website) failed:', err);
  }
  const fields = ai
    ? { name: ai.name || look.name || '', vertical: ai.vertical, rating_question: ai.rating_question }
    : { name: look.name ?? '', vertical: /dent|dds|orthodont|smile|teeth|implant/i.test(look.text) ? ('dental' as const) : ('hospitality' as const) };
  return { look, fields, ai: Boolean(ai) };
}

// ---------- Find on Google ----------

export type PlaceSearchResult = { error: string } | { places: GooglePlace[] };

// "Find on Google": the admin types the business name (and area); we list matches with their review links.
export async function findOnGoogle(query: string): Promise<PlaceSearchResult> {
  await requireAdmin();
  const q = String(query ?? '').trim().slice(0, 200);
  if (q.length < 2) return { error: 'Type the business name, and the area if it has more than one location.' };
  try {
    return { places: await searchPlaces(q) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Google search failed. Try again.' };
  }
}
