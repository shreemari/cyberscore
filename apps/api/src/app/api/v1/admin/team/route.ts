import { NextResponse } from 'next/server';
import {
  ErrorCodes,
  InviteStatus,
  OrgMode,
  ProgressStatus,
  Role,
  type TeamListResponse,
} from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { problem, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';
import { effectiveAllowedLevels } from '@/lib/access';

// GET /api/v1/admin/team
//
// Returns the team roster + pending invites. ENTERPRISE-only; admins/managers
// only. SOLO orgs get 403 since the concept doesn't apply to them.
export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;
  if (auth.role !== Role.ADMIN && auth.role !== Role.MANAGER) {
    return problem(ErrorCodes.FORBIDDEN);
  }

  try {
    const data = await withTenant(auth.orgId, async (tx) => {
      const org = await tx.organisation.findUnique({
        where: { id: auth.orgId },
        select: { mode: true },
      });
      if (!org || org.mode !== OrgMode.ENTERPRISE) return null;

      // Total active KPIs once per request — used to compute completion %.
      const totalKpis = await tx.kpi.count({
        where: { isActive: true, deletedAt: null },
      });

      const users = await tx.user.findMany({
        where: { orgId: auth.orgId, deletedAt: null },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          allowedLevels: true,
          createdAt: true,
          // Aggregate response stats per user.
          responses: {
            select: {
              actualScore: true,
              kpi: { select: { maxScore: true, weightage: true } },
              submittedAt: true,
            },
          },
        },
      });

      const invites = await tx.invite.findMany({
        where: { orgId: auth.orgId, status: InviteStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          email: true,
          role: true,
          allowedLevels: true,
          status: true,
          invitedById: true,
          invitedBy: { select: { name: true } },
          expiresAt: true,
          acceptedAt: true,
          createdAt: true,
        },
      });

      return { totalKpis, users, invites };
    });

    if (!data) return problem(ErrorCodes.FORBIDDEN);

    const members = data.users.map((u) => {
      const answered = u.responses.length;
      const total = data.totalKpis;
      const completionPct = total > 0 ? (answered / total) * 100 : 0;
      const status: ProgressStatus =
        answered === 0
          ? ProgressStatus.NOT_STARTED
          : answered >= total
            ? ProgressStatus.COMPLETED
            : ProgressStatus.IN_PROGRESS;

      // Individual score = weighted % across the KPIs they've answered.
      let scoreSum = 0;
      let weightSum = 0;
      for (const r of u.responses) {
        if (!r.kpi || r.kpi.maxScore === 0) continue;
        const pct = (r.actualScore / r.kpi.maxScore) * 100;
        scoreSum += pct * r.kpi.weightage;
        weightSum += r.kpi.weightage;
      }
      const individualScore = weightSum > 0 ? scoreSum / weightSum : null;

      const lastActiveAt =
        u.responses.length === 0
          ? null
          : new Date(
              Math.max(...u.responses.map((r) => r.submittedAt.getTime())),
            ).toISOString();

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        allowedLevels: effectiveAllowedLevels({
          role: u.role,
          orgMode: OrgMode.ENTERPRISE,
          allowedLevels: u.allowedLevels,
        }),
        joinedAt: u.createdAt.toISOString(),
        lastActiveAt,
        progress: {
          answered,
          total,
          completionPct,
          status,
        },
        individualScore,
      };
    });

    const body: TeamListResponse = {
      members,
      pendingInvites: data.invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        allowedLevels: i.allowedLevels,
        status: i.status,
        invitedById: i.invitedById,
        invitedByName: i.invitedBy?.name ?? null,
        expiresAt: i.expiresAt.toISOString(),
        acceptedAt: i.acceptedAt?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
      })),
    };

    return NextResponse.json(body);
  } catch (err) {
    return internalError(err, { route: 'admin/team' });
  }
}
