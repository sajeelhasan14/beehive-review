import { getCurrentUser } from '@/lib/auth/dal';
import { kitResponse } from '@/lib/kit/serve';

// GET /admin/kit/kyma/qr.png | table-tent.pdf | stickers.pdf -> the print kit for that client's funnel. Admins only.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; file: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') return new Response('Not found', { status: 404 });

  const { slug, file } = await params;
  return kitResponse(slug, file);
}
