import type { AggregatedScorecard } from './scorecard';
import type { AiCompareResponse } from '@cymetric/types';

// Deterministic dev-mode stub for /ai/compare so the insights screen works
// without burning Anthropic quota (or requiring a key at all).
//
// Picks the three lowest-scoring KPIs from the aggregate and emits a
// playbook-style action for each. Risk flags are derived from the same
// underperforming list. Output shape matches AiCompareResponse exactly so
// the client doesn't care whether a real model or the stub produced it.

type StubInput = Omit<
  AiCompareResponse,
  'dailyUsageRemaining' | 'modelUsed' | 'generatedAt'
>;

const IMPACT_FOR_GAP = (gap: number): 'HIGH' | 'MEDIUM' | 'LOW' => {
  if (gap >= 40) return 'HIGH';
  if (gap >= 20) return 'MEDIUM';
  return 'LOW';
};

const SEVERITY_FOR_SCORE = (score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' => {
  if (score < 25) return 'CRITICAL';
  if (score < 50) return 'HIGH';
  return 'MEDIUM';
};

export function buildAiStub(
  agg: AggregatedScorecard,
  opts: { includeRiskFlags: boolean; industry: string | null },
): StubInput {
  const { peopleScore, processScore, companyScore, overallScore, underperforming } = agg;

  // Seed the three priorities from the lowest-scoring KPIs, padded if the
  // org has answered too few for three distinct underperformers.
  const ranked = [...underperforming].sort(
    (a, b) => a.currentScore - b.currentScore,
  );
  const picks = ranked.slice(0, 3);
  while (picks.length < 3) {
    picks.push({
      kpiId: `placeholder-${picks.length}`,
      kpiName:
        picks.length === 0
          ? 'Continue the assessment'
          : `Answer more ${['process', 'company'][picks.length - 1] ?? 'company'} KPIs`,
      currentScore: 0,
      scoreRange: 'RED' as const,
    });
  }

  const threePriorities = picks.map((p) => {
    const gap = Math.max(0, 100 - p.currentScore);
    return {
      kpiName: p.kpiName,
      currentScore: Math.round(p.currentScore),
      industryAverage: null,
      gap: Math.round(gap),
      action: actionFor(p.kpiName, p.currentScore),
      estimatedImpact: IMPACT_FOR_GAP(gap),
    };
  });

  const riskFlags = opts.includeRiskFlags
    ? ranked
        .filter((p) => p.currentScore < 50)
        .slice(0, 5)
        .map((p) => ({
          severity: SEVERITY_FOR_SCORE(p.currentScore),
          title: truncate(`Low score: ${p.kpiName}`, 120),
          description: truncate(
            `Current score ${Math.round(p.currentScore)}/100 is below the 50-point safety threshold. ` +
              `This control is contributing directly to the organisation's red banding and should be triaged in the next operational review.`,
            600,
          ),
          relatedKpiNames: [p.kpiName],
        }))
    : [];

  const industryLine = opts.industry
    ? ` Compared to typical ${opts.industry} organisations, focus on the three priorities below.`
    : '';

  const comparisonSummary = truncate(
    `Overall cyber maturity stands at ${Math.round(overallScore)}/100 ` +
      `(people ${Math.round(peopleScore)}, process ${Math.round(processScore)}, ` +
      `company ${Math.round(companyScore)}).${industryLine} ` +
      `The lowest-scoring areas concentrate in ${picks[0]?.kpiName ?? 'core controls'}, ` +
      `${picks[1]?.kpiName ?? 'process maturity'}, and ${picks[2]?.kpiName ?? 'coverage gaps'}. ` +
      `Closing these three gaps is the fastest path to moving out of the red band.`,
    1200,
  );

  return { comparisonSummary, threePriorities, riskFlags };
}

function actionFor(kpiName: string, score: number): string {
  const name = kpiName.toLowerCase();
  if (name.includes('training') || name.includes('awareness')) {
    return 'Roll a mandatory quarterly training cycle with per-employee pass tracking; publish completion rates to managers weekly.';
  }
  if (name.includes('mttd') || name.includes('detection')) {
    return 'Centralise logs into a SIEM, tune high-signal alerts (auth, EDR, DNS, egress), and run weekly triage reviews to shorten detection time.';
  }
  if (name.includes('mttr') || name.includes('response')) {
    return 'Publish response runbooks for the 5 most common incident types; rehearse them quarterly with a tabletop exercise.';
  }
  if (name.includes('patch')) {
    return 'Pre-stage patches in a test ring; promote to production within the published SLA unless a block is filed.';
  }
  if (name.includes('backup') || name.includes('recovery')) {
    return 'Automate backup integrity checks and alert on failed restores; rehearse a full recovery once per quarter.';
  }
  if (name.includes('vendor') || name.includes('third-party')) {
    return 'Send annual security questionnaires and review responses at every vendor renewal gate.';
  }
  if (name.includes('cloud') || name.includes('misconfiguration')) {
    return 'Enforce infrastructure-as-code, reject drift at merge time, and remediate findings weekly.';
  }
  if (score < 25) {
    return 'Treat this KPI as a board-level priority: assign a single owner, set a 30-day improvement target, and review progress weekly.';
  }
  return 'Identify the top two contributing factors, ship a specific control, and measure weekly progress toward a 75-point target.';
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
