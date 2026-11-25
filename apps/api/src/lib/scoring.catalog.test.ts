import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Kpi } from '@cymetric/types';
import { scoreResponse, type TierLike } from './scoring';

// The actual workbook-derived catalogue is the fixture: every shipped tier
// must have at least one input that reaches exactly its expected score.
const catalog = JSON.parse(
  readFileSync(new URL('../../prisma/seed/kpi-data.json', import.meta.url), 'utf8'),
) as Array<{
  kpiName: string;
  level: string;
  inputType: 'PERCENTAGE' | 'DROPDOWN' | 'RADIO';
  maxScore: number;
  weightage: number;
  nistControlIds: string[];
  isoControlIds: string[];
  tiers: Array<Omit<TierLike, 'id'> & { condition: {
    op: string;
    value?: string | number | boolean;
    min?: number;
    max?: number;
    values?: Array<string | number>;
    exclusive?: boolean;
    exclusiveMin?: boolean;
    exclusiveMax?: boolean;
  } }>;
}>;

function exampleInput(c: typeof catalog[number]['tiers'][number]['condition']): string {
  switch (c.op) {
    case 'eq': return String(c.value);
    case 'lte': return String(Number(c.value) - 1);
    case 'lt': return String(Number(c.value) - 1);
    case 'gte': return String(c.value);
    case 'gt': return String(Number(c.value) + 1);
    case 'range': return String(((c.min ?? 0) + (c.max ?? 0)) / 2);
    case 'in': return String(c.values?.[0] ?? '');
    default: throw new Error('Unexpected tier condition: ' + c.op);
  }
}

describe('the 46 canonical KPI functions', () => {
  it('contains 46 KPIs in People, Process and Company', () => {
    expect(catalog).toHaveLength(46);
    expect(catalog.filter(k => k.level === 'PEOPLE')).toHaveLength(8);
    expect(catalog.filter(k => k.level === 'PROCESS')).toHaveLength(25);
    expect(catalog.filter(k => k.level === 'COMPANY')).toHaveLength(13);
  });

  for (const kpi of catalog) {
    it(`accepts every scoring option for ${kpi.kpiName}`, () => {
      const tiers = kpi.tiers.map((t, i) => ({ ...t, id: `tier-${i}` }));
      expect(kpi.nistControlIds.length).toBeGreaterThan(0);
      expect(kpi.isoControlIds.length).toBeGreaterThan(0);
      Kpi.parse({
        ...kpi,
        id: 'kpi',
        infoText: 'Test',
        frameworkCode: 'EXCEL',
        isCustom: false,
        isActive: true,
        version: 1,
        answerScope: 'ORG',
        tiers,
      });
      for (const tier of tiers) {
        const scored = scoreResponse({
          inputValue: exampleInput(tier.condition),
          tiers,
          maxScore: kpi.maxScore,
          weightage: kpi.weightage,
        });
        expect(scored?.matchedTierId).toBe(tier.id);
        expect(scored?.actualScore).toBe(tier.scoreValue);
        expect(scored?.weightedScore).toBe(tier.scoreValue * kpi.weightage);
      }
      if (kpi.inputType === 'PERCENTAGE') {
        for (let percentage = 0; percentage <= 100; percentage++) {
          expect(scoreResponse({
            inputValue: String(percentage),
            tiers,
            maxScore: kpi.maxScore,
            weightage: kpi.weightage,
          })).not.toBeNull();
        }
      }
    });
  }

  it('rejects empty numeric answers instead of matching zero', () => {
    expect(scoreResponse({
      inputValue: '',
      tiers: [{ id: '0', tierLabel: '0', tierOrder: 1, scoreValue: 10, condition: { op: 'eq', value: 0 } }],
      maxScore: 10,
      weightage: 1,
    })).toBeNull();
  });
});
