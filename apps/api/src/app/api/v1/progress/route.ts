import { NextResponse } from 'next/server';
import { ErrorCodes, Framework, Level } from '@cymetric/types';
import { SaveProgressRequest } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { parseJson, problem, internalError } from '@/lib/problem';
import { canAssessLevel, effectiveAllowedLevels } from '@/lib/access';

// GET /api/v1/progress
// POST /api/v1/progress
//
// Tracks assessment completion per Level so mobile can resume a paused
// session on the question where the user stopped. Progress is isolated by
// framework so KPI, NIST CSF, and ISO 27001 assessments do not overwrite
// one another.
export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  // Older clients that omit framework continue to use EXCEL.
  const requestedFramework =
    new URL(req.url).searchParams.get('framework') ?? Framework.EXCEL;

  if (!Object.values(Framework).includes(requestedFramework as Framework)) {
    return NextResponse.json(
      {
        error: 'Invalid framework',
        detail: 'Use EXCEL, NIST_CSF, or ISO27001.',
      },
      { status: 400 },
    );
  }

  const frameworkCode = requestedFramework as Framework;

  try {
    const payload = await withTenant(auth.orgId, async (tx) => {
      const [user, progressRows, kpis] = await Promise.all([
        tx.user.findUnique({
          where: { id: auth.userId },
          select: {
            role: true,
            allowedLevels: true,
            org: { select: { mode: true } },
          },
        }),
        tx.assessmentProgress.findMany({
          where: { orgId: auth.orgId, userId: auth.userId, frameworkCode },
        }),
        tx.kpi.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            status: 'PUBLISHED',
            frameworkCode,
          },
          select: { id: true, level: true },
        }),
      ]);

      const responses = kpis.length
        ? await tx.response.findMany({
            where: {
              orgId: auth.orgId,
              submittedById: auth.userId,
              kpiId: { in: kpis.map((k) => k.id) },
            },
            select: { kpiId: true },
          })
        : [];

      const answered = new Set(responses.map((r) => r.kpiId));
      return { user, progressRows, kpis, answered };
    });

    if (!payload.user) return problem(ErrorCodes.AUTH_TOKEN_INVALID);

    const allowed = new Set(
      effectiveAllowedLevels({
        role: payload.user.role,
        orgMode: payload.user.org.mode,
        allowedLevels: payload.user.allowedLevels,
      }),
    );

    const levels = Object.values(Level)
      .filter((level) => allowed.has(level))
      .map((level) => {
        const progress = payload.progressRows.find((p) => p.level === level);
        const levelKpis = payload.kpis.filter((k) => k.level === level);
        const total = levelKpis.length;
        const done = levelKpis.filter((k) => payload.answered.has(k.id)).length;
        const completionPct = total === 0 ? 0 : Math.round((done / total) * 100);

        return {
          level,
          status: progress?.status ?? 'NOT_STARTED',
          lastQuestionIndex: progress?.lastQuestionIndex ?? 0,
          pausedAt: progress?.pausedAt?.toISOString() ?? null,
          completionPct,
        };
      });

    return NextResponse.json({ framework: frameworkCode, levels });
  } catch (err) {
    return internalError(err, { route: 'progress:get' });
  }
}

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, SaveProgressRequest);
  if (!parsed.ok) return parsed.response;

  // Keep compatibility with older clients and schemas that omit this field.
  const frameworkCode = parsed.data.frameworkCode ?? Framework.EXCEL;
  const { level, lastQuestionIndex, status } = parsed.data;

  try {
    const row = await withTenant(auth.orgId, async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { role: true, allowedLevels: true, org: { select: { mode: true } } },
      });
      if (!user) return { kind: 'unauth' as const };

      if (
        !canAssessLevel(
          { role: user.role, orgMode: user.org.mode, allowedLevels: user.allowedLevels },
          level,
        )
      ) {
        return { kind: 'forbidden' as const };
      }

      const upserted = await tx.assessmentProgress.upsert({
        where: {
          orgId_userId_level_frameworkCode: {
            orgId: auth.orgId,
            userId: auth.userId,
            level,
            frameworkCode,
          },
        },
        create: {
          orgId: auth.orgId,
          userId: auth.userId,
          level,
          frameworkCode,
          lastQuestionIndex,
          status,
          pausedAt: status === 'IN_PROGRESS' ? new Date() : null,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        },
        update: {
          lastQuestionIndex,
          status,
          pausedAt: status === 'IN_PROGRESS' ? new Date() : null,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        },
      });

      return { kind: 'ok' as const, row: upserted };
    });

    if (row.kind === 'unauth') return problem(ErrorCodes.AUTH_TOKEN_INVALID);
    if (row.kind === 'forbidden') {
      return problem(ErrorCodes.FORBIDDEN, {
        detail: `You don't have access to ${level} assessments.`,
      });
    }

    return NextResponse.json({
      frameworkCode: row.row.frameworkCode,
      level: row.row.level,
      status: row.row.status,
      lastQuestionIndex: row.row.lastQuestionIndex,
      pausedAt: row.row.pausedAt?.toISOString() ?? null,
    });
  } catch (err) {
    return internalError(err, { route: 'progress:save' });
  }
}
