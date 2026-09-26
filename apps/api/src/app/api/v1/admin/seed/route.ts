import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Framework, InputType, Level } from '@prisma/client';
import type { ScoreRange, SuggestionPriority } from '@cymetric/types';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { problem, internalError } from '@/lib/problem';
import { ErrorCodes } from '@cymetric/types';
import { logger } from '@/lib/logger';
import {
  SUGGESTIONS_BY_KPI,
  GENERIC_SUGGESTIONS,
  type SuggestionSeed,
} from '../../../../../../prisma/seed/suggestions';

// POST /api/v1/admin/seed
//
// HTTP entry-point to the same seed logic that prisma/seed.ts runs via
// `npm run db:seed`. Guard: only runs when the KPI table is empty. This is
// a safety rail for prod — if a row count check fails, the caller is told
// to use the proper migration/seed pipeline instead of hot-seeding a live DB.
//
// Returns a summary so the admin can verify the result in one request.

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

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  try {
    const existingCount = await prisma.kpi.count();
    if (existingCount > 0) {
      return problem(ErrorCodes.CONFLICT, {
        detail: `Refusing to seed — KPI table already has ${existingCount} rows. Use db:seed locally or clear the table first.`,
      });
    }

    const raw = readFileSync(
      resolve(process.cwd(), 'prisma/seed/kpi-data.json'),
      'utf-8',
    );
    const kpis: KpiSeed[] = JSON.parse(raw);

    let created = 0;
    let tierCount = 0;
    let suggestionCount = 0;

    for (const [idx, seed] of kpis.entries()) {
      const kpi = await prisma.kpi.create({
        data: {
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
        },
      });
      created++;

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

      const suggestions: SuggestionSeed[] =
        SUGGESTIONS_BY_KPI[seed.kpiName] ?? GENERIC_SUGGESTIONS;
      await prisma.kpiSuggestion.createMany({
        data: suggestions.map((s) => ({
          kpiId: kpi.id,
          scoreRange: s.scoreRange as ScoreRange,
          suggestionText: s.suggestionText,
          priority: s.priority as SuggestionPriority,
        })),
      });
      suggestionCount += suggestions.length;
    }

    logger.info({ created, tierCount, suggestionCount }, 'admin seed complete');
    return NextResponse.json({
      seeded: true,
      kpis: created,
      tiers: tierCount,
      suggestions: suggestionCount,
    });
  } catch (err) {
    return internalError(err, { route: 'admin:seed' });
  }
}
