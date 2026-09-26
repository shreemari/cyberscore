import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, Framework, InputType, Level } from '@prisma/client';
import type { ScoreRange, SuggestionPriority } from '@cymetric/types';
import {
  SUGGESTIONS_BY_KPI,
  GENERIC_SUGGESTIONS,
  type SuggestionSeed,
} from './seed/suggestions';

// Seeds the 46 canonical KPIs (tiers + suggestions) from kpi-data.json.
//
//   npm run db:seed
//
// Idempotent: re-running wipes and re-creates each KPI's tiers + suggestions
// from scratch. Safe in dev; in prod it preserves existing Response rows
// because Kpi rows are matched by (kpiName + frameworkCode) and only
// updated, never deleted.

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

    // Replace tiers wholesale — cheaper than diffing and keeps ordering clean.
    await prisma.scoringTier.deleteMany({ where: { kpiId: kpi.id } });
    await prisma.scoringTier.createMany({
      data: seed.tiers.map((t) => ({
        kpiId: kpi.id,
        tierLabel: t.tierLabel,
        condition: t.condition as object,
        scoreValue: t.scoreValue,
        tierOrder: t.tierOrder,
      })),
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
