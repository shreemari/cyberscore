import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { internalError } from '@/lib/problem';

// GET /api/v1/admin/orgs
//
// Admin org directory — name, plan, completeness %, latest overall score.
// Supports ?q= (substring on orgName/email) and ?limit= (default 50, max 200).
// Uses the latest ScorecardSnapshot as the score pointer so we don't recompute
// 46-KPI aggregates N times per page load.
export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const cursor = url.searchParams.get('cursor') ?? undefined;

  try {
    const orgs = await prisma.organisation.findMany({
      where: {
        deletedAt: null,
        ...(q && {
          OR: [
            { orgName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        orgName: true,
        industry: true,
        email: true,
        plan: true,
        isVerified: true,
        createdAt: true,
        snapshots: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
          select: {
            overallScore: true,
            completeness: true,
            generatedAt: true,
          },
        },
        _count: { select: { users: true, responses: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const nextCursor = orgs.length > limit ? orgs[limit - 1]?.id : null;
    const page = orgs.slice(0, limit).map((o) => ({
      id: o.id,
      orgName: o.orgName,
      industry: o.industry,
      email: o.email,
      plan: o.plan,
      isVerified: o.isVerified,
      createdAt: o.createdAt.toISOString(),
      userCount: o._count.users,
      responseCount: o._count.responses,
      latestScore: o.snapshots[0]?.overallScore ?? null,
      completeness: o.snapshots[0]?.completeness ?? null,
      lastSnapshotAt: o.snapshots[0]?.generatedAt.toISOString() ?? null,
    }));

    return NextResponse.json({ orgs: page, nextCursor });
  } catch (err) {
    return internalError(err, { route: 'admin:orgs:list' });
  }
}
