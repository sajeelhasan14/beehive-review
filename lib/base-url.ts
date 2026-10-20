import 'server-only';

// The public address of this app, for links that leave the browser (QR codes, the copy package).
// PUBLIC_BASE_URL wins (set it once the custom domain is live); otherwise it comes from the request,
// using Railway's x-forwarded-* headers so it's the public address and not the container's.
export function baseUrl(h: Headers): string {
  const fixed = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  if (fixed) return fixed;
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
