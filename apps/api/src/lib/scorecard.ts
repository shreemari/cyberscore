import type { Prisma } from '@prisma/client';
import { AnswerScope, Level, OrgMode, Role, ScoreRange, scoreRangeFor } from '@cymetric/types';

// Score aggregation — the single source of truth for every scorecard number
// the API returns. Keep this pure; it takes the raw KPI catalogue + response
// rows and produces the shaped response. The live GET /scorecard endpoint,
// the snapshot writer, and the share/public view all call the same function.
//
// Semantics:
//  - N/A responses are excluded from both numerator and denominator (they
//    neither help nor hurt). Unanswered KPIs are counted against maxPossible
//    so completeness reflects the honest answered-vs-total ratio.
//  - Scores are percentages (0..100) derived from
//      sum(weightedScore) / sum(maxScore * weightage) * 100
//    for each level. Overall is the same calc across all KPIs, not the
//    average of the three level percentages — a level with a single heavy KPI
//    shouldn't dominate when averaged.

export interface KpiLite {
  id: string;
  kpiName: string;
  level: Level;
  maxScore: number;
  weightage: number;
  // Optional — defaults to ORG for backwards-compat with callers that
  // haven't been refreshed past the enterprise-mode migration.
  answerScope?: AnswerScope;
}

export interface ResponseLite {
  kpiId: string;
  actualScore: number;
  weightedScore: number;
  isNa: boolean;
}

export interface LevelBreakdown {
  score: number;
  maxPossible: number;
  answered: number;
  total: number;
  colorBand: ScoreRange;
}

export interface AggregatedScorecard {
  peopleScore: number;
  processScore: number;
  companyScore: number;
  overallScore: number;
  completeness: number;
  colorBand: ScoreRange;
  levelBreakdown: {
    people: LevelBreakdown;
    process: LevelBreakdown;
    company: LevelBreakdown;
  };
  // KPIs currently in RED or AMBER — caller joins these to KpiSuggestion rows.
  underperforming: Array<{
    kpiId: string;
    kpiName: string;
    currentScore: number;
    scoreRange: ScoreRange;
  }>;
}

function computeLevel(
  kpis: KpiLite[],
  responses: Map<string, ResponseLite>,
): LevelBreakdown {
  let weighted = 0;
  let maxWeighted = 0;
  let answered = 0;
  for (const kpi of kpis) {
    const resp = responses.get(kpi.id);
    if (resp && !resp.isNa) {
      weighted += resp.weightedScore;
      maxWeighted += kpi.maxScore * kpi.weightage;
      answered++;
    } else if (resp?.isNa) {
      // Excluded entirely — no numerator, no denominator.
      answered++;
    } else {
      // Unanswered — counts toward maxPossible (the user is losing points
      // by not answering, not gaining a free 100%).
      maxWeighted += kpi.maxScore * kpi.weightage;
    }
  }
  const score = maxWeighted === 0 ? 0 : (weighted / maxWeighted) * 100;
  return {
    score: round2(score),
    maxPossible: round2(maxWeighted),
    answered,
    total: kpis.length,
    colorBand: scoreRangeFor(score),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function aggregate(kpis: KpiLite[], responses: ResponseLite[]): AggregatedScorecard {
  const byId = new Map(responses.map((r) => [r.kpiId, r]));
  const byLevel = {
    people: kpis.filter((k) => k.level === Level.PEOPLE),
    process: kpis.filter((k) => k.level === Level.PROCESS),
    company: kpis.filter((k) => k.level === Level.COMPANY),
  };

  const people = computeLevel(byLevel.people, byId);
  const proc = computeLevel(byLevel.process, byId);
  const company = computeLevel(byLevel.company, byId);

  const all = computeLevel(kpis, byId);

  const answeredCount = responses.filter((r) => !r.isNa).length;
  const completeness = kpis.length === 0 ? 0 : (answeredCount / kpis.length) * 100;

  const kpiNameById = new Map(kpis.map((k) => [k.id, k.kpiName]));
  const underperforming = responses
    .filter((r) => !r.isNa)
    .map((r) => {
      const kpi = kpis.find((k) => k.id === r.kpiId);
      if (!kpi) return null;
      const pct = (r.actualScore / kpi.maxScore) * 100;
      return {
        kpiId: r.kpiId,
        kpiName: kpiNameById.get(r.kpiId) ?? 'Unknown',
        currentScore: round2(pct),
        scoreRange: scoreRangeFor(pct),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.scoreRange !== ScoreRange.GREEN);

  return {
    peopleScore: people.score,
    processScore: proc.score,
    companyScore: company.score,
    overallScore: all.score,
    completeness: round2(completeness),
    colorBand: scoreRangeFor(all.score),
    levelBreakdown: { people, process: proc, company },
    underperforming,
  };
}

// Loader that both the live endpoint and the snapshot job share.
//
// Enterprise-mode rollup:
//   - ORG-scope KPIs: pick the admin's response. If no admin response yet,
//     ignore other rows and treat the KPI as unanswered. (Employees may have
//     submitted, but their input on ORG-scope KPIs is consensus-only.)
//   - EMPLOYEE-scope KPIs: average actualScore + weightedScore across every
//     non-NA submitter so the company score reflects the team aggregate.
// SOLO orgs keep the old behaviour — there's only one user, so the dedupe
// is a no-op.
export async function loadScorecardInputs(
  tx: Prisma.TransactionClient,
  orgId: string,
): Promise<{ kpis: KpiLite[]; responses: ResponseLite[] }> {
  const org = await tx.organisation.findUnique({
    where: { id: orgId },
    select: { mode: true },
  });

  const adminId =
    org?.mode === OrgMode.ENTERPRISE
      ? (
          await tx.user.findFirst({
            where: { orgId, role: Role.ADMIN, deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          })
        )?.id ?? null
      : null;

  const [kpis, rawResponses] = await Promise.all([
    tx.kpi.findMany({
      where: { isActive: true, deletedAt: null, status: 'PUBLISHED' },
      select: {
        id: true,
        kpiName: true,
        level: true,
        maxScore: true,
        weightage: true,
        answerScope: true,
      },
    }),
    tx.response.findMany({
      where: { orgId },
      select: {
        kpiId: true,
        actualScore: true,
        weightedScore: true,
        isNa: true,
        submittedById: true,
      },
    }),
  ]);

  const responses = rollupResponses({
    kpis,
    rawResponses,
    isEnterprise: org?.mode === OrgMode.ENTERPRISE,
    adminId,
  });

  return { kpis, responses };
}

interface RawResponse extends ResponseLite {
  submittedById: string | null;
}

export function rollupResponses(args: {
  kpis: KpiLite[];
  rawResponses: RawResponse[];
  isEnterprise: boolean;
  adminId: string | null;
}): ResponseLite[] {
  if (!args.isEnterprise) {
    // SOLO — dedupe defensively in case a stale duplicate snuck in, but
    // there's no scope-aware aggregation to do.
    const byKpi = new Map<string, ResponseLite>();
    for (const r of args.rawResponses) {
      if (!byKpi.has(r.kpiId)) {
        byKpi.set(r.kpiId, {
          kpiId: r.kpiId,
          actualScore: r.actualScore,
          weightedScore: r.weightedScore,
          isNa: r.isNa,
        });
      }
    }
    return [...byKpi.values()];
  }

  const scopeByKpi = new Map<string, AnswerScope>(
    args.kpis.map((k) => [k.id, k.answerScope ?? AnswerScope.ORG]),
  );
  const grouped = new Map<string, RawResponse[]>();
  for (const r of args.rawResponses) {
    const arr = grouped.get(r.kpiId) ?? [];
    arr.push(r);
    grouped.set(r.kpiId, arr);
  }

  const out: ResponseLite[] = [];
  for (const [kpiId, rows] of grouped) {
    const scope = scopeByKpi.get(kpiId) ?? AnswerScope.ORG;
    if (scope === AnswerScope.ORG) {
      // Admin authoritative. Employees may have submitted; ignore them here.
      const adminRow =
        args.adminId != null
          ? rows.find((r) => r.submittedById === args.adminId)
          : undefined;
      if (adminRow) {
        out.push({
          kpiId,
          actualScore: adminRow.actualScore,
          weightedScore: adminRow.weightedScore,
          isNa: adminRow.isNa,
        });
      }
      continue;
    }
    // EMPLOYEE — average across non-NA submitters. If everyone marked it NA,
    // surface a single NA row so the KPI is excluded entirely.
    const counted = rows.filter((r) => !r.isNa);
    if (counted.length === 0) {
      out.push({ kpiId, actualScore: 0, weightedScore: 0, isNa: true });
      continue;
    }
    const actual =
      counted.reduce((sum, r) => sum + r.actualScore, 0) / counted.length;
    const weighted =
      counted.reduce((sum, r) => sum + r.weightedScore, 0) / counted.length;
    out.push({
      kpiId,
      actualScore: actual,
      weightedScore: weighted,
      isNa: false,
    });
  }
  return out;
}
