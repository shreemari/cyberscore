import { NextResponse } from 'next/server';
import { OrgMode, Role, ScoreRange } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { internalError } from '@/lib/problem';
import { aggregate, loadScorecardInputs } from '@/lib/scorecard';
import { effectiveAllowedLevels } from '@/lib/access';

// GET /api/v1/scorecard
//
// Live (not snapshot) scorecard for the caller's org. Cheap enough to compute
// on each call — 46 KPIs * N responses fits comfortably in a single tx.
//
// Snapshots are written by a worker on a schedule so we can plot trends
// without recomputing history from audit logs. The endpoint just returns the
// `latestSnapshot` pointer so mobile can label the view with its age.
export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  try {
    const payload = await withTenant(auth.orgId, async (tx) => {
      // Caller's effective levels — for non-admin enterprise employees we
      // narrow the scorecard inputs to just their own responses + only the
      // KPIs in their allowed levels. Admins and SOLO see the full org view.
      const caller = await tx.user.findUnique({
        where: { id: auth.userId },
        select: {
          role: true,
          allowedLevels: true,
          org: { select: { mode: true } },
        },
      });
      if (!caller) return null;

      const callerLevels = effectiveAllowedLevels({
        role: caller.role,
        orgMode: caller.org.mode,
        allowedLevels: caller.allowedLevels,
      });
      const isPersonalView =
        caller.org.mode === OrgMode.ENTERPRISE && caller.role !== Role.ADMIN;

      const { kpis, responses } = await loadScorecardInputs(tx, auth.orgId);

      // Personal-view scorecard: filter the KPI catalogue to allowed levels
      // and only count this user's own responses.
      let scopedKpis = kpis;
      let scopedResponses = responses;
      if (isPersonalView) {
        const allowed = new Set(callerLevels);
        scopedKpis = kpis.filter((k) => allowed.has(k.level));
        const personal = await tx.response.findMany({
          where: { orgId: auth.orgId, submittedById: auth.userId },
          select: { kpiId: true, actualScore: true, weightedScore: true, isNa: true },
        });
        scopedResponses = personal;
      }

      const agg = aggregate(scopedKpis, scopedResponses);

      // Suggestions for underperforming KPIs — group by (kpiId, scoreRange).
      const suggestions =
        agg.underperforming.length === 0
          ? []
          : await tx.kpiSuggestion.findMany({
              where: {
                kpiId: { in: agg.underperforming.map((u) => u.kpiId) },
                scoreRange: { in: [ScoreRange.RED, ScoreRange.AMBER] },
              },
            });

      const latestSnapshot = await tx.scorecardSnapshot.findFirst({
        where: { orgId: auth.orgId },
        orderBy: { generatedAt: 'desc' },
        select: { id: true, generatedAt: true },
      });

      return { agg, suggestions, latestSnapshot, isPersonalView, callerLevels };
    });

    if (!payload) return internalError(new Error('user not found'), { route: 'scorecard:get' });

    const improvementSuggestions = payload.agg.underperforming.map((u) => ({
      kpiId: u.kpiId,
      kpiName: u.kpiName,
      currentScore: u.currentScore,
      scoreRange: u.scoreRange,
      suggestions: payload.suggestions
        .filter((s) => s.kpiId === u.kpiId && s.scoreRange === u.scoreRange)
        .map((s) => ({ text: s.suggestionText, priority: s.priority })),
    }));

    return NextResponse.json({
      peopleScore: payload.agg.peopleScore,
      processScore: payload.agg.processScore,
      companyScore: payload.agg.companyScore,
      overallScore: payload.agg.overallScore,
      completeness: payload.agg.completeness,
      colorBand: payload.agg.colorBand,
      levelBreakdown: payload.agg.levelBreakdown,
      improvementSuggestions,
      latestSnapshot: payload.latestSnapshot
        ? {
            id: payload.latestSnapshot.id,
            generatedAt: payload.latestSnapshot.generatedAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    return internalError(err, { route: 'scorecard:get' });
  }
}
