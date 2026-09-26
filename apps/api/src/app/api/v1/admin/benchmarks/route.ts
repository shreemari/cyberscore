import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ErrorCodes } from '@cymetric/types';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { parseJson, problem, internalError } from '@/lib/problem';

// Admin benchmarks — rows are (kpiId, industry) unique. The API read side
// (/ai/compare) only exposes aggregates when sampleSize >= 20; admins can
// still write rows below that threshold so a dataset can be grown over time
// before any user sees it. A write with sampleSize < 1 is rejected because
// an "avg" computed from zero samples is meaningless.

const K_ANON_MIN = 20;

const UpsertBenchmarkRequest = z.object({
  kpiId: z.string().min(1),
  industry: z.string().min(2).max(100),
  avgScore: z.number().min(0).max(100),
  topPercentileScore: z.number().min(0).max(100),
  sampleSize: z.number().int().min(1),
  source: z.string().min(1).max(200),
});

// GET /api/v1/admin/benchmarks
//
// Supports ?industry= and ?kpiId= filters. Returns rows regardless of k —
// admins need visibility into below-threshold data to decide whether to
// keep collecting; the k-anon gate is enforced at the user-facing read.
export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const url = new URL(req.url);
  const industry = url.searchParams.get('industry')?.trim();
  const kpiId = url.searchParams.get('kpiId')?.trim();

  try {
    const rows = await prisma.industryBenchmark.findMany({
      where: {
        ...(industry && { industry }),
        ...(kpiId && { kpiId }),
      },
      include: {
        kpi: { select: { id: true, kpiName: true, level: true } },
      },
      orderBy: [{ industry: 'asc' }, { kpiId: 'asc' }],
    });

    return NextResponse.json({
      benchmarks: rows.map((r) => ({
        id: r.id,
        kpiId: r.kpiId,
        kpiName: r.kpi.kpiName,
        level: r.kpi.level,
        industry: r.industry,
        avgScore: r.avgScore,
        topPercentileScore: r.topPercentileScore,
        sampleSize: r.sampleSize,
        source: r.source,
        meetsKAnonThreshold: r.sampleSize >= K_ANON_MIN,
        lastUpdated: r.lastUpdated.toISOString(),
      })),
    });
  } catch (err) {
    return internalError(err, { route: 'admin:benchmarks:list' });
  }
}

// POST /api/v1/admin/benchmarks
//
// Idempotent upsert keyed on (kpiId, industry). Bumps lastUpdated on
// every write — the staleness signal feeds the admin "refresh benchmarks"
// view.
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, UpsertBenchmarkRequest);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const kpi = await prisma.kpi.findFirst({
      where: { id: body.kpiId, deletedAt: null },
      select: { id: true },
    });
    if (!kpi) return problem(ErrorCodes.KPI_NOT_FOUND);

    const row = await prisma.industryBenchmark.upsert({
      where: { kpiId_industry: { kpiId: body.kpiId, industry: body.industry } },
      create: {
        kpiId: body.kpiId,
        industry: body.industry,
        avgScore: body.avgScore,
        topPercentileScore: body.topPercentileScore,
        sampleSize: body.sampleSize,
        source: body.source,
      },
      update: {
        avgScore: body.avgScore,
        topPercentileScore: body.topPercentileScore,
        sampleSize: body.sampleSize,
        source: body.source,
        lastUpdated: new Date(),
      },
    });

    return NextResponse.json(
      {
        id: row.id,
        meetsKAnonThreshold: row.sampleSize >= K_ANON_MIN,
      },
      { status: 201 },
    );
  } catch (err) {
    return internalError(err, { route: 'admin:benchmarks:upsert' });
  }
}
