import type { TierCondition } from '@cymetric/types';

// Evaluates a single KPI response against its scoring tiers.
//
// Input values arrive as strings (PERCENTAGE → "42", DROPDOWN/RADIO → the
// tierLabel itself). We coerce numerics once, then match the first tier
// whose condition is satisfied, scanning in tierOrder ascending (best → worst).
//
// Returns null when nothing matches — the caller translates that to
// KPI_NO_MATCHING_TIER so mobile can surface a real error rather than a
// silently-zeroed score.

export interface TierLike {
  id: string;
  tierLabel: string;
  tierOrder: number;
  scoreValue: number;
  condition: TierCondition | unknown;
}

export interface ScoreResult {
  matchedTierId: string;
  actualScore: number;
  weightedScore: number;
}

export function parseNumericInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function matches(cond: TierCondition, inputValue: string, asNumber: number | null): boolean {
  switch (cond.op) {
    case 'lte':
      return asNumber !== null && asNumber <= cond.value;
    case 'lt':
      return asNumber !== null && asNumber < cond.value;
    case 'gte':
      return asNumber !== null && asNumber >= cond.value;
    case 'gt':
      return asNumber !== null && asNumber > cond.value;
    case 'range':
      return asNumber !== null && asNumber >= cond.min && asNumber <= cond.max;
    case 'eq':
      if (typeof cond.value === 'number') return asNumber !== null && asNumber === cond.value;
      if (typeof cond.value === 'boolean') return inputValue === String(cond.value);
      return inputValue === cond.value;
    case 'in':
      if (asNumber !== null && cond.values.some((v) => typeof v === 'number' && v === asNumber)) {
        return true;
      }
      return cond.values.some((v) => typeof v === 'string' && v === inputValue);
  }
}

export function scoreResponse(args: {
  inputValue: string;
  tiers: TierLike[];
  maxScore: number;
  weightage: number;
}): ScoreResult | null {
  const asNumber = parseNumericInput(args.inputValue);
  // Scan best → worst so the most generous match wins ties.
  const sorted = [...args.tiers].sort((a, b) => a.tierOrder - b.tierOrder);
  for (const tier of sorted) {
    if (matches(tier.condition as TierCondition, args.inputValue, asNumber)) {
      return {
        matchedTierId: tier.id,
        actualScore: tier.scoreValue,
        weightedScore: tier.scoreValue * args.weightage,
      };
    }
  }
  return null;
}
