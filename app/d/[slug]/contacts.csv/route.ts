import { getClientAccess } from '@/lib/auth/dal';
import { getContactsForExport } from '@/lib/data/dashboard';

// GET /d/kyma/contacts.csv -> Kyma's contacts only ("Download my sheet"). Same access rule as the dashboard.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Quote every cell, and stop spreadsheet apps from running a typed "=..." as a formula.
function cell(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getClientAccess(slug);
  if (!access) return new Response('Not found', { status: 404 });

  const date = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  const rows = (await getContactsForExport(access.client.id)).map((g) => [
    g.first_name, g.last_name, g.phone, g.email,
    g.birthday_month ? `${MONTHS[g.birthday_month - 1]} ${g.birthday_day ?? ''}`.trim() : '',
    g.last_rating, g.visits, g.sms_consent ? 'yes' : 'no', date(g.first_seen_at), date(g.last_seen_at), g.last_feedback,
  ]);
  const header = ['First name', 'Last name', 'Phone', 'Email', 'Birthday', 'Last rating', 'Visits', 'SMS consent', 'First seen', 'Last seen', 'Last feedback'];
  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-contacts.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
