import { NextResponse } from 'next/server';
import { Role, ErrorCodes } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { problem, internalError } from '@/lib/problem';

// GET /api/v1/team
//
// Returns every member of the caller's org with a recent-activity summary.
// MANAGER and ADMIN only — EMPLOYEE doesn't need to see peers.
//
// `lastSubmissionAt` is the max submittedAt across the user's responses;
// a single grouped aggregate is cheaper than an N+1 fetch per user.
export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;
  if (auth.role === Role.EMPLOYEE) return problem(ErrorCodes.FORBIDDEN);

  try {
    const data = await withTenant(auth.orgId, async (tx) => {
      const users = await tx.user.findMany({
        where: { orgId: auth.orgId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          totpEnabled: true,
          createdAt: true,
        },
      });

      const submissions = await tx.response.groupBy({
        by: ['submittedById'],
        where: { orgId: auth.orgId, submittedById: { not: null } },
        _count: { _all: true },
        _max: { submittedAt: true },
      });
      const byUser = new Map(
        submissions.map((s) => [
          s.submittedById,
          { count: s._count._all, lastAt: s._max.submittedAt },
        ]),
      );

      return users.map((u) => {
        const agg = byUser.get(u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          totpEnabled: u.totpEnabled,
          submissionCount: agg?.count ?? 0,
          lastSubmissionAt: agg?.lastAt?.toISOString() ?? null,
          joinedAt: u.createdAt.toISOString(),
        };
      });
    });

    return NextResponse.json({ items: data });
  } catch (err) {
    return internalError(err, { route: 'team:list' });
  }
}
