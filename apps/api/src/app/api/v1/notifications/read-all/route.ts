import { NextResponse } from 'next/server';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { internalError } from '@/lib/problem';

// POST /api/v1/notifications/read-all
//
// Marks every unread notification on the caller's org as read. Fires from
// the "Mark all as read" menu in the mobile notification tray.
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  try {
    const result = await withTenant(auth.orgId, (tx) =>
      tx.notification.updateMany({
        where: { orgId: auth.orgId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      }),
    );
    return NextResponse.json({ updated: result.count });
  } catch (err) {
    return internalError(err, { route: 'notifications:read-all' });
  }
}
