import { NextResponse } from 'next/server';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { internalError } from '@/lib/problem';

// GET /api/v1/notifications
//
// Inbox for the mobile bell icon. Newest first, capped at 100 — mobile
// shows a "see older" CTA that paginates with `?before=<id>` if needed.
// unreadCount is returned separately so the badge on the icon doesn't
// have to parse the items array.
export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const url = new URL(req.url);
  const before = url.searchParams.get('before');

  try {
    const data = await withTenant(auth.orgId, async (tx) => {
      const [items, unreadCount] = await Promise.all([
        tx.notification.findMany({
          where: {
            orgId: auth.orgId,
            ...(before && { id: { lt: before } }),
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        tx.notification.count({
          where: { orgId: auth.orgId, isRead: false },
        }),
      ]);
      return { items, unreadCount };
    });

    return NextResponse.json({
      items: data.items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        isRead: n.isRead,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount: data.unreadCount,
      nextCursor: data.items.length === 100 ? data.items[data.items.length - 1]?.id : null,
    });
  } catch (err) {
    return internalError(err, { route: 'notifications:list' });
  }
}
