'use server';

import { refresh } from 'next/cache';
import { db } from '@/lib/db';
import { requireClientAccess, requireUser } from '@/lib/auth/dal';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "Mark resolved" on an unhappy alert. Admins can resolve any; a client only their own.
export async function resolveAlert(submissionId: string): Promise<void> {
  const user = await requireUser();
  if (!UUID.test(submissionId)) throw new Error('Invalid alert');
  await db().query(
    `update submissions set resolved_at = now()
      where id = $1 and path = 'unhappy' and resolved_at is null
        and ($2::boolean or client_id = $3::uuid)`,
    [submissionId, user.role === 'admin', user.clientId],
  );
  refresh();
}

// "Upgrade" on the Tier 1 wall: flags the client so EMRG sees it on the admin card.
export async function requestUpgrade(slug: string): Promise<void> {
  const { client } = await requireClientAccess(slug);
  await db().query('update clients set upgrade_requested_at = coalesce(upgrade_requested_at, now()) where id = $1', [client.id]);
  refresh();
}
