import { getClientAccess } from '@/lib/auth/dal';
import { kitResponse } from '@/lib/kit/serve';

// GET /d/kyma/kit/qr.png -> the same print kit, for Kyma's own login ("Your QR kit" on the dashboard).
// Same rule as the dashboard: admins, or that client's own users while their dashboard is on.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await params;
  const access = await getClientAccess(slug);
  if (!access || (access.user.role !== 'admin' && !access.client.dashboard_enabled)) return new Response('Not found', { status: 404 });
  return kitResponse(slug, file);
}
