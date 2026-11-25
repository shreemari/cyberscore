import { NextResponse } from 'next/server';
import { Role } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { internalError } from '@/lib/problem';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;
  try {
    const result = await withTenant(auth.orgId, async tx => {
      const user = await tx.user.findUnique({
        where: { id: auth.userId }, select: { role: true },
      });
      if (!user || user.role !== Role.ADMIN) return null;
      return tx.auditLog.findMany({
        where: {
          orgId: auth.orgId,
          action: { in: ['KPI_SUBMITTED', 'KPI_NA_MARKED', 'KPI_UPDATED', 'SCORE_CALCULATED', 'ACTION_UPDATED', 'EVIDENCE_UPLOADED'] },
        },
        take: 100,
        orderBy: { createdAt: 'desc' },
        select: { id: true, action: true, resource: true, actorId: true, createdAt: true, before: true, after: true },
      });
    });
    if (!result) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    return NextResponse.json({
      items: result.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })),
    });
  } catch (err) {
    return internalError(err, { route: 'audit:assessments' });
  }
}
