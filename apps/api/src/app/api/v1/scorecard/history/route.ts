import { NextResponse } from 'next/server';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { internalError } from '@/lib/problem';

// GET /api/v1/scorecard/history
//
// Returns snapshot history newest-first for trend rendering on mobile.
// Capped at 52 rows (≈1 year of weekly snapshots) — mobile's chart view
// doesn't need more, and larger payloads hurt cold-open latency.
export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  try {
    const items = await withTenant(auth.orgId, (tx) =>
      tx.scorecardSnapshot.findMany({
        where: { orgId: auth.orgId },
        orderBy: { generatedAt: 'desc' },
        take: 52,
        select: {
          id: true,
          peopleScore: true,
          processScore: true,
          companyScore: true,
          overallScore: true,
          completeness: true,
          feedbackText: true,
          generatedAt: true,
        },
      }),
    );

    return NextResponse.json({
      items: items.map((s) => ({
        ...s,
        generatedAt: s.generatedAt.toISOString(),
      })),
    });
  } catch (err) {
    return internalError(err, { route: 'scorecard:history' });
  }
}
