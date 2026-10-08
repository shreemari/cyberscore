import { NextResponse } from 'next/server';
import { OrgMode, Role, ScoreRange } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { internalError } from '@/lib/problem';
import { aggregate, loadScorecardInputs } from '@/lib/scorecard';
import { effectiveAllowedLevels } from '@/lib/access';

// GET /api/v1/scorecard
//
// Live (not snapshot) scorecard for the caller's org.
// ?framework=EXCEL|NIST_CSF|ISO27001 can explicitly select a framework.
// When omitted, the organisation's selectedFramework is used.
export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  try {
    const url = new URL(req.url);
    const requestedFramework = url.searchParams.get('framework')?.trim() ?? null;

    const payload = await withTenant(auth.orgId, async (tx) => {
      const caller = await tx.user.findUnique({
        where: { id: auth.userId },
        select: {
          role: true,
          allowedLevels: true,
          org: {
            select: {
              mode: true,
              selectedFramework: true,
            },
          },
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

      const selectedFramework =
        requestedFramework === 'NIST_CSF' ||
        requestedFramework === 'ISO27001' ||
        requestedFramework === 'EXCEL'
          ? requestedFramework
          : caller.org.selectedFramework ?? 'EXCEL';

      const { kpis, responses } = await loadScorecardInputs(
        tx,
        auth.orgId,
        selectedFramework,
      );

      let scopedKpis = kpis;
      let scopedResponses = responses;

      if (isPersonalView) {
        const allowed = new Set(callerLevels);
        scopedKpis = kpis.filter((k) => allowed.has(k.level));

        const personal = await tx.response.findMany({
          where: { orgId: auth.orgId, submittedById: auth.userId },
          select: {
            kpiId: true,
            actualScore: true,
            weightedScore: true,
            isNa: true,
          },
        });

        scopedResponses = personal;
      }

      const agg = aggregate(scopedKpis, scopedResponses);

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

      return {
        agg,
        suggestions,
        latestSnapshot,
        isPersonalView,
        callerLevels,
        selectedFramework,
      };
    });

    if (!payload) {
      return internalError(new Error('user not found'), { route: 'scorecard:get' });
    }

    const improvementSuggestions = payload.agg.underperforming.map((u) => ({
      kpiId: u.kpiId,
      kpiName: u.kpiName,
      currentScore: u.currentScore,
      scoreRange: u.scoreRange,
      suggestions: payload.suggestions
        .filter((s) => s.kpiId === u.kpiId && s.scoreRange === u.scoreRange)
        .map((s) => ({
          text: s.suggestionText,
          priority: s.priority,
        })),
    }));

    return NextResponse.json({
      framework: payload.selectedFramework,
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
