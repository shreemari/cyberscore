
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, Framework, InputType, Level } from '@prisma/client';
import type { ScoreRange, SuggestionPriority } from '@cymetric/types';
import {
  SUGGESTIONS_BY_KPI,
  GENERIC_SUGGESTIONS,
  type SuggestionSeed,
} from './seed/suggestions';

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

  let created = 0;
  let updated = 0;
  let tierCount = 0;
  let suggestionCount = 0;

  for (const [idx, seed] of kpis.entries()) {
    const frameworks = [
      {
        frameworkCode: Framework.EXCEL,
        nistControlIds: seed.nistControlIds,
        isoControlIds: seed.isoControlIds,
      },
      ...(seed.nistControlIds.length > 0
        ? [{
            frameworkCode: Framework.NIST_CSF,
            nistControlIds: seed.nistControlIds,
            isoControlIds: [],
          }]
        : []),
      ...(seed.isoControlIds.length > 0
        ? [{
            frameworkCode: Framework.ISO27001,
            nistControlIds: [],
            isoControlIds: seed.isoControlIds,
          }]
        : []),
    ];

    for (const framework of frameworks) {
      const existing = await prisma.kpi.findFirst({
        where: {
          kpiName: seed.kpiName,
          frameworkCode: framework.frameworkCode,
          deletedAt: null,
        },
      });

      const kpiData = {
        kpiName: seed.kpiName,
        level: seed.level,
        maxScore: seed.maxScore,
        weightage: seed.weightage,
        inputType: seed.inputType,
        infoText: seed.infoText,
        frameworkCode: framework.frameworkCode,
        nistControlIds: framework.nistControlIds,
        isoControlIds: framework.isoControlIds,
        displayOrder: idx,
        isCustom: false,
        isActive: true,
      };

      const kpi = existing
        ? await prisma.kpi.update({
            where: { id: existing.id },
            data: kpiData,
          })
        : await prisma.kpi.create({
            data: kpiData,
          });

      if (existing) updated++;
      else created++;

      // Preserve existing tiers. Create them only if none exist.
      const existingTiers = await prisma.scoringTier.count({
        where: { kpiId: kpi.id },
      });

      if (existingTiers === 0) {
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
      }

      // Preserve existing suggestions. Create them only if none exist.
      const existingSuggestions = await prisma.kpiSuggestion.count({
        where: { kpiId: kpi.id },
      });

      if (existingSuggestions === 0) {
        const suggestionSeeds: SuggestionSeed[] =
          SUGGESTIONS_BY_KPI[seed.kpiName] ?? GENERIC_SUGGESTIONS;

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
    }
  }

  console.log(
    `Done. KPI records: ${created} created, ${updated} updated. ` +
      `New tiers: ${tierCount}. New suggestions: ${suggestionCount}.`,
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
