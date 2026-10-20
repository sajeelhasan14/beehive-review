import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { FontPairing, Template } from '@/lib/funnel/render';

// "Their website" in Add client: reads a business's site and pulls out its look (logo, brand color,
// font style, light or dark) plus the words that describe it. No browser, no packages: plain HTML + CSS.
//
// The URL comes from an admin's form, but the server is the one fetching it, so every request
// (and every redirect) is checked: http(s) only, public addresses only, short timeout, size cap.

export interface WebsiteLook {
  website: string;
  name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  font_pairing: FontPairing | null;
  font_name: string | null;
  template: Template | null;
  text: string; // title + description + headings, for the smart fill
}

const TIMEOUT_MS = 8000;
const MAX_HTML = 1_500_000;
const MAX_CSS = 600_000;

// ---------- Safe fetch ----------

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  );
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https websites can be read.');
  if (url.username || url.password) throw new Error('That address is not allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new Error('That website could not be found. Check the address.');
  if (addresses.some((a) => isPrivateIp(a.address))) throw new Error('That address is not allowed.');
}

async function fetchText(start: URL, maxBytes: number): Promise<{ url: URL; body: string; type: string }> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // A normal browser's headers: many small-business hosts turn away anything that looks like a bot.
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,text/css,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if ([401, 403, 429, 503].includes(res.status)) {
      throw new Error('That website blocks automatic reading. Set their logo and color under More options instead.');
    }
    if (!res.ok) throw new Error(`The website answered with an error (${res.status}).`);
    // Read at most maxBytes, then stop (a huge page shouldn't tie up the server).
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      if (size >= maxBytes) {
        await reader.cancel();
        break;
      }
    }
    return { url, body: Buffer.concat(chunks).toString('utf8'), type: res.headers.get('content-type') ?? '' };
  }
  throw new Error('That website redirects too many times.');
}

// ---------- Small HTML helpers (regex is enough for <head> tags) ----------

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)));

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '').trim() : null;
}

function meta(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = (attr(tag, 'property') ?? attr(tag, 'name') ?? '').toLowerCase();
    if (k === key) return attr(tag, 'content');
  }
  return null;
}

const absolute = (href: string | null, base: URL) => {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
};

// ---------- Color ----------

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function parseColor(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})\b/);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
    return `#${h}`.toUpperCase();
  }
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return toHex(+m[1], +m[2], +m[3]);
  return null;
}

function hsl(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  return { s, l };
}

// Default blues that come with WordPress, Bootstrap and browsers. They show up on many sites, but they
// are nobody's brand.
const FRAMEWORK_DEFAULTS = new Set(['#007CBA', '#006BA1', '#005A87', '#0073AA', '#2271B1', '#0D6EFD', '#007BFF', '#337AB7', '#0000EE', '#0066CC', '#1E73BE']);

// A brand color has some color in it: not white, black or grey, and not a framework default.
const isBrandy = (hex: string) => {
  const { s, l } = hsl(hex);
  return s >= 0.25 && l >= 0.12 && l <= 0.85 && !FRAMEWORK_DEFAULTS.has(hex);
};

function brandColor(html: string, css: string): string | null {
  const theme = parseColor(meta(html, 'theme-color') ?? '');
  if (theme && isBrandy(theme)) return theme;

  // Custom properties named like a brand color: --primary, --brand, --color-accent, --wp--preset--color--primary ...
  for (const m of css.matchAll(/(--[\w-]*(?:primary|brand|accent|main|theme)[\w-]*)\s*:\s*([^;}{]+)/gi)) {
    if (/wp-admin|wp--preset--color--(?:vivid|luminous|pale|cyan|black|white)/i.test(m[1])) continue;
    const c = parseColor(m[2]);
    if (c && isBrandy(c)) return c;
  }

  // Otherwise the colorful value the stylesheets use most.
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/gi)) {
    const c = parseColor(m[0]);
    if (c && isBrandy(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// Dark site -> dark funnel (midnight), light site -> light funnel (ivory).
function pageTemplate(css: string): Template | null {
  const m = css.match(/(?:^|[},\s])(?:html|body)\s*\{[^}]*background(?:-color)?\s*:\s*([^;}]+)/i);
  const c = m && parseColor(m[1]);
  if (!c) return null;
  return hsl(c).l < 0.35 ? 'midnight' : 'ivory';
}

// ---------- Fonts ----------

const SERIF = /playfair|bodoni|didot|baskerville|garamond|caslon|cormorant|fraunces|lora|merriweather|crimson|dm serif|libre caslon|prata|cinzel|serif\b/i;
const DISPLAY = /archivo black|anton|bebas|oswald|league gothic|alfa slab|black ops|bungee|righteous|monoton/i;

function fonts(html: string, css: string): { pairing: FontPairing | null; name: string | null } {
  const names: string[] = [];
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/gi)) {
    for (const f of decode(m[1]).matchAll(/family=([^:&]+)/g)) names.push(f[1].replace(/\+/g, ' '));
  }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const first = m[1].split(',')[0].replace(/["']/g, '').trim();
    if (first && !/^(inherit|initial|var\(|-apple-system|system-ui|sans-serif|serif|monospace|arial|helvetica)/i.test(first)) names.push(first);
  }
  if (!names.length) return { pairing: null, name: null };

  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const display = top.find((n) => DISPLAY.test(n)) ?? top.find((n) => SERIF.test(n)) ?? top[0];

  // Map their look onto the funnel's five built-in pairings.
  let pairing: FontPairing = 'modern';
  if (DISPLAY.test(display)) pairing = 'bold';
  else if (/playfair|bodoni|didot|prata|cinzel/i.test(display)) pairing = 'classic';
  else if (/baskerville|garamond|caslon|cormorant|lora|crimson/i.test(display)) pairing = 'quiet';
  else if (SERIF.test(display)) pairing = 'editorial';
  return { pairing, name: display };
}

// ---------- Logo ----------

function logo(html: string, base: URL): string | null {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const icon = (rel: RegExp) => {
    const found = links
      .filter((t) => rel.test(attr(t, 'rel') ?? ''))
      .map((t) => ({ href: attr(t, 'href'), size: Number((attr(t, 'sizes') ?? '').split('x')[0]) || 0 }))
      .sort((a, b) => b.size - a.size)[0];
    return found ? absolute(found.href, base) : null;
  };
  // Square app icons fit the funnel's round badge best; then a logo image; then a large favicon.
  const apple = icon(/apple-touch-icon/i);
  if (apple) return apple;
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const hint = `${attr(tag, 'class') ?? ''} ${attr(tag, 'id') ?? ''} ${attr(tag, 'alt') ?? ''} ${attr(tag, 'src') ?? ''}`;
    if (/logo/i.test(hint)) {
      const src = absolute(attr(tag, 'src') ?? attr(tag, 'data-src'), base);
      if (src && !src.startsWith('data:')) return src;
    }
  }
  return icon(/(^|\s)icon(\s|$)/i) ?? absolute(meta(html, 'og:image'), base);
}

// ---------- Name and words ----------

function siteName(html: string): string | null {
  const raw = meta(html, 'og:site_name') || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  // "Kyma | Greek Restaurant in FL & NY" -> "Kyma"
  return raw.trim().split(/\s+[|–—\-:·•]\s+/)[0]?.trim() || null;
}

function words(html: string): string {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const desc = meta(html, 'description') ?? meta(html, 'og:description') ?? '';
  const heads = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 8);
  return [title, desc, ...heads].join('\n').slice(0, 2000);
}

// ---------- Main ----------

export async function readWebsite(input: string): Promise<WebsiteLook> {
  let start: URL;
  try {
    start = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw new Error('That doesn’t look like a website address.');
  }

  const page = await fetchText(start, MAX_HTML);
  if (!/html/i.test(page.type) && !/<html/i.test(page.body.slice(0, 2000))) throw new Error('That address isn’t a web page.');
  const html = page.body;

  // Their CSS: inline <style> blocks plus the first few stylesheets.
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  css += '\n' + [...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join(';');
  const sheets = (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((t) => /stylesheet/i.test(attr(t, 'rel') ?? '') && !/fonts\.googleapis/i.test(attr(t, 'href') ?? ''))
    .map((t) => absolute(attr(t, 'href'), page.url))
    .filter((u): u is string => Boolean(u))
    .slice(0, 4);
  const loaded = await Promise.allSettled(sheets.map((u) => fetchText(new URL(u), MAX_CSS)));
  for (const r of loaded) if (r.status === 'fulfilled') css += '\n' + r.value.body;

  const font = fonts(html, css);
  return {
    website: page.url.href,
    name: siteName(html),
    logo_url: logo(html, page.url),
    brand_color: brandColor(html, css),
    font_pairing: font.pairing,
    font_name: font.name,
    template: pageTemplate(css),
    text: words(html),
  };
}
