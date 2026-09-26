import Anthropic from '@anthropic-ai/sdk';
import type { Prisma } from '@prisma/client';
import { env } from './env';

// Anthropic client singleton and daily-budget plumbing.
//
// Budget policy:
//  - Each org gets env.AI_FREE_DAILY_CALLS calls/day on the Sonnet primary model.
//  - When a call's estimated cost would push the global day above
//    env.ANTHROPIC_DAILY_BUDGET_USD we auto-switch to the Haiku fallback.
//  - Hard ceiling: once BOTH budgets are exhausted, return AI_BUDGET_EXHAUSTED
//    and let the caller surface a friendly error.
//
// Pricing table is approximate — we don't need billing-grade accuracy here,
// just enough to throttle before the monthly Anthropic invoice surprises us.

const DEFAULT_PRICE = { input: 3, output: 15 };
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-7': { input: 15, output: 75 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

let cached: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (cached) return cached;
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  cached = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return cached;
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICE_PER_MTOK[model] ?? DEFAULT_PRICE;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export async function recordUsage(
  tx: Prisma.TransactionClient,
  args: {
    orgId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  },
): Promise<void> {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const cost = estimateCostUsd(args.model, args.inputTokens, args.outputTokens);

  await tx.aiUsage.upsert({
    where: {
      orgId_day_model: { orgId: args.orgId, day, model: args.model },
    },
    create: {
      orgId: args.orgId,
      day,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      callCount: 1,
      estimatedCostUsd: cost,
    },
    update: {
      inputTokens: { increment: args.inputTokens },
      outputTokens: { increment: args.outputTokens },
      callCount: { increment: 1 },
      estimatedCostUsd: { increment: cost },
    },
  });
}

export async function dailyCallsForOrg(
  tx: Prisma.TransactionClient,
  orgId: string,
): Promise<number> {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const rows = await tx.aiUsage.findMany({
    where: { orgId, day },
    select: { callCount: true },
  });
  return rows.reduce((sum, r) => sum + r.callCount, 0);
}

export async function globalDailySpendUsd(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const rows = await tx.aiUsage.findMany({
    where: { day },
    select: { estimatedCostUsd: true },
  });
  return rows.reduce((sum, r) => sum + r.estimatedCostUsd, 0);
}

// Escapes backticks and closes any user-planted </user_content> tags so
// injected instructions can't break out of the sandbox we wrap their text in.
export function sanitiseUserText(text: string): string {
  return text
    .replace(/<\/?user_content>/gi, '')
    .replace(/`/g, "'")
    .slice(0, 4000);
}
