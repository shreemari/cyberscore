import { NextResponse } from 'next/server';
import {
  AnswerScope,
  ErrorCodes,
  OrgMode,
  Role,
  type ConsensusSignal,
  type TeamScorecardResponse,
} from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { problem, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';
import { aggregate, loadScorecardInputs } from '@/lib/scorecard';

// GET /api/v1/admin/scorecard
//
// ENTERPRISE admin's aggregated team view. Reuses the standard scoring
// engine (admin-authoritative for ORG scope, averaged for EMPLOYEE scope)
// then layers consensus signals on top: ORG-scope KPIs where employees
// disagree with the admin in meaningful numbers.
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

      const adminUser = await tx.user.findFirst({
        where: { orgId: auth.orgId, role: Role.ADMIN, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      const { kpis, responses: aggregated } = await loadScorecardInputs(tx, auth.orgId);
      const summary = aggregate(kpis, aggregated);

      // Pull the raw rows again (with submittedById) for consensus analysis —
      // can't recover that from `aggregated` since the rollup throws away
      // identity. Cheap query and only ENTERPRISE admins hit this route.
      const rawRows = await tx.response.findMany({
        where: { orgId: auth.orgId, isNa: false },
        select: {
          kpiId: true,
          actualScore: true,
          submittedById: true,
          matchedTier: { select: { tierLabel: true } },
        },
      });

      const memberCount = await tx.user.count({
        where: { orgId: auth.orgId, deletedAt: null },
      });
      const activeAnswerers = await tx.user.count({
        where: {
          orgId: auth.orgId,
          deletedAt: null,
          responses: { some: {} },
        },
      });

      return {
        summary,
        kpis,
        rawRows,
        adminId: adminUser?.id ?? null,
        memberCount,
        activeAnswerers,
      };
    });

    if (!data) return problem(ErrorCodes.FORBIDDEN);

    const consensusSignals: ConsensusSignal[] = [];
    const orgKpis = data.kpis.filter(
      (k) => (k.answerScope ?? AnswerScope.ORG) === AnswerScope.ORG,
    );
    const kpiNameById = new Map(data.kpis.map((k) => [k.id, k.kpiName]));

    for (const kpi of orgKpis) {
      const rowsForKpi = data.rawRows.filter((r) => r.kpiId === kpi.id);
      const adminRow = data.adminId
        ? rowsForKpi.find((r) => r.submittedById === data.adminId)
        : undefined;
      if (!adminRow) continue;
      const employeeRows = rowsForKpi.filter(
        (r) => r.submittedById !== null && r.submittedById !== data.adminId,
      );
      if (employeeRows.length === 0) continue;

      // Distribution by chosen tier label — easier to read than raw scores.
      const dist = new Map<string, number>();
      for (const r of employeeRows) {
        const label = r.matchedTier?.tierLabel ?? 'Unknown';
        dist.set(label, (dist.get(label) ?? 0) + 1);
      }
      const adminScore = adminRow.actualScore;
      const disagreements = employeeRows.filter(
        (r) => r.actualScore !== adminScore,
      ).length;
      const disagreementRate = disagreements / employeeRows.length;

      // Surface signals where >25% of employees disagree — anything below is
      // noise; above is worth the admin's attention.
      if (disagreementRate >= 0.25) {
        consensusSignals.push({
          kpiId: kpi.id,
          kpiName: kpiNameById.get(kpi.id) ?? 'Unknown',
          adminScore,
          employeeDistribution: [...dist.entries()].map(([tierLabel, count]) => ({
            tierLabel,
            count,
          })),
          disagreementRate,
        });
      }
    }

    // Sort consensus signals by disagreement rate descending — most divergent first.
    consensusSignals.sort((a, b) => b.disagreementRate - a.disagreementRate);

    const body: TeamScorecardResponse = {
      overallScore: data.summary.overallScore,
      completeness: data.summary.completeness,
      memberCount: data.memberCount,
      activeAnswerers: data.activeAnswerers,
      consensusSignals,
    };
    return NextResponse.json(body);
  } catch (err) {
    return internalError(err, { route: 'admin/scorecard' });
  }
}
