
import { describe, expect, it } from 'vitest';
import { aggregate, type KpiLite, type ResponseLite } from './scorecard';
import { Level, ScoreRange } from '@cymetric/types';

const kpis: KpiLite[] = [
  {
    id: 'KPI-001',
    kpiName: 'Security Awareness',
    level: Level.PEOPLE,
    maxScore: 4,
    weightage: 1,
  },
  {
    id: 'KPI-002',
    kpiName: 'Incident Response',
    level: Level.PROCESS,
    maxScore: 4,
    weightage: 1,
  },
  {
    id: 'KPI-003',
    kpiName: 'Security Governance',
    level: Level.COMPANY,
    maxScore: 4,
    weightage: 1,
  },
];

describe('CyMetric KPI Scorecard', () => {
  it('returns zero completeness when unanswered', () => {
    const result = aggregate(kpis, []);

    expect(result.completeness).toBe(0);
    expect(result.overallScore).toBe(0);
  });

  it('calculates a fully completed scorecard', () => {
    const responses: ResponseLite[] = kpis.map((kpi) => ({
      kpiId: kpi.id,
      actualScore: 4,
      weightedScore: 4,
      isNa: false,
    }));

    const result = aggregate(kpis, responses);

    expect(result.completeness).toBe(100);
    expect(result.overallScore).toBe(100);
    expect(result.colorBand).toBe(ScoreRange.GREEN);
  });

  it('counts N/A as completed but excludes it from scoring', () => {
    const responses: ResponseLite[] = [
      {
        kpiId: 'KPI-001',
        actualScore: 4,
        weightedScore: 4,
        isNa: false,
      },
      {
        kpiId: 'KPI-002',
        actualScore: 0,
        weightedScore: 0,
        isNa: true,
      },
    ];

    const result = aggregate(kpis, responses);

    expect(result.completeness).toBe(66.67);
    expect(result.levelBreakdown.process.answered).toBe(1);
    expect(result.overallScore).toBe(50);
  });

  it('prevents duplicate answers from inflating completeness', () => {
    const responses: ResponseLite[] = [
      {
        kpiId: 'KPI-001',
        actualScore: 4,
        weightedScore: 4,
        isNa: false,
      },
      {
        kpiId: 'KPI-001',
        actualScore: 4,
        weightedScore: 4,
        isNa: false,
      },
    ];

    const result = aggregate(kpis, responses);

    expect(result.completeness).toBe(33.33);
  });

  it('uses the documented 50% and 80% score band boundaries', () => {
    const single = [kpis[0]!];
    for (const [percentage, expected] of [
      [49, ScoreRange.RED],
      [50, ScoreRange.AMBER],
      [79, ScoreRange.AMBER],
      [80, ScoreRange.GREEN],
    ] as const) {
      const result = aggregate(single, [{
        kpiId: single[0]!.id,
        actualScore: (percentage / 100) * 4,
        weightedScore: (percentage / 100) * 4,
        isNa: false,
      }]);
      expect(result.colorBand).toBe(expected);
      expect(result.underperforming[0]?.scoreRange ?? ScoreRange.GREEN).toBe(expected);
    }
  });

  it('does not repeat underperforming KPIs when duplicate rows are present', () => {
    const repeated: ResponseLite = {
      kpiId: 'KPI-001',
      actualScore: 1,
      weightedScore: 1,
      isNa: false,
    };
    const result = aggregate(kpis, [repeated, repeated]);
    expect(result.underperforming).toHaveLength(1);
    expect(result.underperforming[0]?.kpiId).toBe('KPI-001');
  });
});
