import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { internalError } from '@/lib/problem';

// GET /api/v1/admin/audit-logs
//
// Cursor-paginated audit log viewer. Filters:
//   ?action=LOGIN_SUCCESS     — exact match on action enum
//   ?actorId=<userId>         — who did it
//   ?orgId=<orgId>            — which tenant was affected
//   ?from=<ISO>&to=<ISO>      — time window
//   ?cursor=<id>&limit=50     — cursor on createdAt (id tiebreak)
//
// audit_logs is append-only (CHECK constraint in migration), so "latest first"
// ordering by (createdAt DESC, id DESC) is stable and index-backed.
export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const url = new URL(req.url);
  const action = url.searchParams.get('action')?.trim();
  const actorId = url.searchParams.get('actorId')?.trim();
  const orgId = url.searchParams.get('orgId')?.trim();
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const cursor = url.searchParams.get('cursor')?.trim();
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);

  const createdAt: Record<string, Date> = {};
  if (from) createdAt.gte = new Date(from);
  if (to) createdAt.lte = new Date(to);

  try {
    const rows = await prisma.auditLog.findMany({
      where: {
        ...(action && { action }),
        ...(actorId && { actorId }),
        ...(orgId && { orgId }),
        ...(Object.keys(createdAt).length > 0 && { createdAt }),
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        org: { select: { id: true, orgName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const nextCursor = rows.length > limit ? rows[limit - 1]?.id : null;
    return NextResponse.json({
      logs: rows.slice(0, limit).map((r) => ({
        id: r.id,
        action: r.action,
        resource: r.resource,
        actor: r.actor,
        org: r.org,
        before: r.before,
        after: r.after,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        traceId: r.traceId,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor,
    });
  } catch (err) {
    return internalError(err, { route: 'admin:audit-logs:list' });
  }
}
