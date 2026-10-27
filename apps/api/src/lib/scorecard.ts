import type { Prisma } from '@prisma/client';
import { AnswerScope, Level, OrgMode, Role, ScoreRange, scoreRangeFor } from '@cymetric/types';

// Score aggregation — the single source of truth for every scorecard number
// the API returns. Keep this pure; it takes the raw KPI catalogue + response
// rows and produces the shaped response. The live GET /scorecard endpoint,
// the snapshot writer, and the share/public view all call the same function.

export interface KpiLite {
  id: string;
  kpiName: string;
  level: Level;
  maxScore: number;
  weightage: number;
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
      answered++;
    } else {
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

export function aggregate(
  kpis: KpiLite[],
  responses: ResponseLite[],
): AggregatedScorecard {
  // Use a single response per KPI for score calculations. Duplicate response
  // rows must not increase completeness beyond the number of KPIs in scope.
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

  // Count unique, answered KPI IDs that belong to this framework's KPI list.
  // This prevents unrelated-framework and duplicate responses from inflating
  // completeness. N/A answers are not counted as answered for completeness.
  const kpiIds = new Set(kpis.map((k) => k.id));
  const answeredCount = new Set(
    responses
      .filter((r) => kpiIds.has(r.kpiId) && !r.isNa)
      .map((r) => r.kpiId),
  ).size;

  const completeness =
    kpis.length === 0
      ? 0
      : Math.min(100, (answeredCount / kpis.length) * 100);

  const underperforming = responses
    .filter((r) => !r.isNa && kpiIds.has(r.kpiId))
    .map((r) => {
      const kpi = kpis.find((k) => k.id === r.kpiId);
      if (!kpi) return null;

      const pct = kpi.maxScore === 0 ? 0 : (r.actualScore / kpi.maxScore) * 100;

      return {
        kpiId: r.kpiId,
        kpiName: kpi.kpiName,
        currentScore: round2(pct),
        scoreRange: scoreRangeFor(pct),
      };
    })
    .filter(
      (x): x is NonNullable<typeof x> =>
        x !== null && x.scoreRange !== ScoreRange.GREEN,
    );

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

// Framework-aware loader. Only KPIs belonging to the selected framework are
// included in the scorecard calculation.
export async function loadScorecardInputs(
  tx: Prisma.TransactionClient,
  orgId: string,
  framework?: string | null,
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
      where: {
        isActive: true,
        deletedAt: null,
        status: 'PUBLISHED',
        ...(framework &&
          framework !== 'all' && {
            frameworkCode: framework as never,
          }),
      },
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
    const kpiIds = new Set(args.kpis.map((k) => k.id));
    const byKpi = new Map<string, ResponseLite>();

    for (const r of args.rawResponses) {
      // Ignore response rows for KPIs outside the selected framework.
      if (!kpiIds.has(r.kpiId)) continue;

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
    // Ignore response rows for KPIs outside the selected framework.
    if (!scopeByKpi.has(r.kpiId)) continue;

    const arr = grouped.get(r.kpiId) ?? [];
    arr.push(r);
    grouped.set(r.kpiId, arr);
  }

  const out: ResponseLite[] = [];

  for (const [kpiId, rows] of grouped) {
    const scope = scopeByKpi.get(kpiId) ?? AnswerScope.ORG;

    if (scope === AnswerScope.ORG) {
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
