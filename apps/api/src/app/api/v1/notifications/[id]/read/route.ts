import { NextResponse } from 'next/server';
import { ErrorCodes } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { problem, internalError } from '@/lib/problem';

// POST /api/v1/notifications/:id/read
//
// Idempotent — sending `read` on an already-read notification is a no-op.
// We don't accept batch-read via this route; mobile has a separate
// /notifications/read-all endpoint for that.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const { id } = await params;

  try {
    const row = await withTenant(auth.orgId, async (tx) => {
      const existing = await tx.notification.findFirst({
        where: { id, orgId: auth.orgId },
      });
      if (!existing) return null;
      if (existing.isRead) return existing;
      return tx.notification.update({
        where: { id: existing.id },
        data: { isRead: true, readAt: new Date() },
      });
    });
    if (!row) return problem(ErrorCodes.NOT_FOUND);
    return NextResponse.json({
      id: row.id,
      isRead: row.isRead,
      readAt: row.readAt?.toISOString() ?? null,
    });
  } catch (err) {
    return internalError(err, { route: 'notifications:read' });
  }
}
