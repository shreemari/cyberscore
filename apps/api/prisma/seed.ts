import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, Framework, InputType, Level } from '@prisma/client';
import { TierCondition, type ScoreRange, type SuggestionPriority } from '@cymetric/types';
import {
  SUGGESTIONS_BY_KPI,
  GENERIC_SUGGESTIONS,
  type SuggestionSeed,
} from './seed/suggestions';

// Seeds the 46 canonical KPIs (tiers + suggestions) from kpi-data.json.
//
//   npm run db:seed
//
// Idempotent: re-running updates KPI scoring tiers in place, preserving
// matchedTierId references on historical responses. Review and back up data
// before applying any seed to a production database.

interface KpiSeed {
  kpiName: string;
  level: Level;
  category: string;
  maxScore: number;
  weightage: number;
  inputType: InputType;
  infoText: string;
  nistControlIds: string[];
  isoControlIds: string[];
  tiers: Array<{
    tierLabel: string;
    scoreValue: number;
    condition: unknown;
    tierOrder: number;
  }>;
}

const prisma = new PrismaClient();

async function main() {
  const raw = readFileSync(
    resolve(__dirname, 'seed/kpi-data.json'),
    'utf-8',
  );
  const kpis: KpiSeed[] = JSON.parse(raw);

  if (kpis.length !== 46 || new Set(kpis.map((k) => k.kpiName)).size !== 46) {
    throw new Error('Expected exactly 46 uniquely named canonical KPI records.');
  }
  for (const kpi of kpis) {
    if (kpi.maxScore <= 0 || kpi.weightage <= 0 || !kpi.tiers.length) {
      throw new Error(`Invalid scoring weights or missing tiers: ${kpi.kpiName}`);
    }
    const orders = new Set(kpi.tiers.map((tier) => tier.tierOrder));
    if (orders.size !== kpi.tiers.length) {
      throw new Error(`Duplicate tier order: ${kpi.kpiName}`);
    }
    const ordered = [...kpi.tiers].sort((a, b) => a.tierOrder - b.tierOrder);
    if (!ordered.some((tier) => tier.scoreValue === kpi.maxScore)) {
      throw new Error(`Unattainable maximum score: ${kpi.kpiName}`);
    }
    for (const [index, tier] of ordered.entries()) {
      TierCondition.parse(tier.condition);
      if (tier.scoreValue < 0 || tier.scoreValue > kpi.maxScore) {
        throw new Error(`Out-of-range tier score: ${kpi.kpiName}`);
      }
      if (index > 0 && tier.scoreValue >= ordered[index - 1]!.scoreValue) {
        throw new Error(`Tier scores must decrease strictly: ${kpi.kpiName}`);
      }
    }
  }

  console.log(`Seeding ${kpis.length} KPIs…`);

  let created = 0;
  let updated = 0;
  let tierCount = 0;
  let suggestionCount = 0;

  for (const [idx, seed] of kpis.entries()) {
    const existing = await prisma.kpi.findFirst({
      where: {
        kpiName: seed.kpiName,
        frameworkCode: Framework.EXCEL,
      },
    });

    const kpiData = {
      kpiName: seed.kpiName,
      level: seed.level,
      maxScore: seed.maxScore,
      weightage: seed.weightage,
      inputType: seed.inputType,
      infoText: seed.infoText,
      frameworkCode: Framework.EXCEL,
      nistControlIds: seed.nistControlIds,
      isoControlIds: seed.isoControlIds,
      displayOrder: idx,
      isCustom: false,
      isActive: true,
    };

    const kpi = existing
      ? await prisma.kpi.update({ where: { id: existing.id }, data: kpiData })
      : await prisma.kpi.create({ data: kpiData });

    if (existing) updated++;
    else created++;

    // Keep tier IDs stable for stored Response.matchedTierId references.
    // Deleting/recreating tiers would erase those references via ON DELETE SET NULL.
    for (const tier of seed.tiers) {
      const tierData = {
        tierLabel: tier.tierLabel,
        condition: tier.condition as object,
        scoreValue: tier.scoreValue,
      };
      await prisma.scoringTier.upsert({
        where: { kpiId_tierOrder: { kpiId: kpi.id, tierOrder: tier.tierOrder } },
        create: { kpiId: kpi.id, tierOrder: tier.tierOrder, ...tierData },
        update: tierData,
      });
    }
    await prisma.scoringTier.deleteMany({
      where: { kpiId: kpi.id, tierOrder: { notIn: seed.tiers.map((t) => t.tierOrder) } },
    });
    tierCount += seed.tiers.length;

    const suggestionSeeds: SuggestionSeed[] =
      SUGGESTIONS_BY_KPI[seed.kpiName] ?? GENERIC_SUGGESTIONS;

    await prisma.kpiSuggestion.deleteMany({ where: { kpiId: kpi.id } });
    await prisma.kpiSuggestion.createMany({
      data: suggestionSeeds.map((s) => ({
        kpiId: kpi.id,
        scoreRange: s.scoreRange as ScoreRange,
        suggestionText: s.suggestionText,
        priority: s.priority as SuggestionPriority,
      })),
    });
    suggestionCount += suggestionSeeds.length;
  }

  console.log(
    `Done. KPIs: ${created} created, ${updated} updated. ` +
      `Tiers: ${tierCount}. Suggestions: ${suggestionCount}.`,
  );
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
