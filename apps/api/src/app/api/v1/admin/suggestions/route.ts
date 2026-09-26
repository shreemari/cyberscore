import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ScoreRange, SuggestionPriority, ErrorCodes } from '@cymetric/types';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { parseJson, problem, internalError } from '@/lib/problem';

// POST /api/v1/admin/suggestions — append a KpiSuggestion row.
//
// Suggestions are additive: the scorecard endpoint returns every matching
// row for a KPI+band, so admins can layer org-specific playbook copy on
// top of the seeded defaults without editing the seed.

const CreateSuggestionRequest = z.object({
  kpiId: z.string().min(1),
  scoreRange: z.nativeEnum(ScoreRange),
  suggestionText: z.string().min(10).max(2000),
  priority: z.nativeEnum(SuggestionPriority).default(SuggestionPriority.MEDIUM),
});

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, CreateSuggestionRequest);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const kpi = await prisma.kpi.findFirst({
      where: { id: body.kpiId, deletedAt: null },
      select: { id: true },
    });
    if (!kpi) return problem(ErrorCodes.KPI_NOT_FOUND);

    const row = await prisma.kpiSuggestion.create({
      data: {
        kpiId: body.kpiId,
        scoreRange: body.scoreRange,
        suggestionText: body.suggestionText,
        priority: body.priority,
      },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return internalError(err, { route: 'admin:suggestions:create' });
  }
}
