
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
});
