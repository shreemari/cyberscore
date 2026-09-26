import { NextResponse } from 'next/server';
import { ProgressStatus, type Level } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { internalError } from '@/lib/problem';
import { effectiveAllowedLevels } from '@/lib/access';

// GET /api/v1/auth/me
//
// Called on every app open after biometric unlock. Returns the user +
// org + per-level progress + latest scorecard snapshot — enough for the
// mobile app to render the Dashboard without a second round-trip.
export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  try {
    const data = await withTenant(auth.orgId, async (tx) => {
      const [user, progressRows, kpiCounts, snapshot] = await Promise.all([
        tx.user.findUnique({
          where: { id: auth.userId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            totpEnabled: true,
            allowedLevels: true,
            org: {
              select: {
                id: true,
                orgName: true,
                industry: true,
                plan: true,
                selectedFramework: true,
                isVerified: true,
                mode: true,
                emailDomain: true,
                joinMode: true,
                frameworkLocked: true,
              },
            },
          },
        }),
        // Per-user progress so the dashboard's resume index reflects this
        // user's own work in ENTERPRISE orgs, not the team's mash-up.
        tx.assessmentProgress.findMany({
          where: { orgId: auth.orgId, userId: auth.userId },
        }),
        tx.kpi.groupBy({
          by: ['level'],
          where: { isActive: true, deletedAt: null },
          _count: { _all: true },
        }),
        tx.scorecardSnapshot.findFirst({
          where: { orgId: auth.orgId },
          orderBy: { generatedAt: 'desc' },
          select: {
            id: true,
            peopleScore: true,
            processScore: true,
            companyScore: true,
            overallScore: true,
            completeness: true,
            generatedAt: true,
          },
        }),
      ]);

      return { user, progressRows, kpiCounts, snapshot };
    });

    if (!data.user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Build per-level progress with completion %. If a row is missing for
    // a level, return defaults (NOT_STARTED, 0%).
    const totalsByLevel: Record<Level, number> = {
      PEOPLE: 0,
      PROCESS: 0,
      COMPANY: 0,
    };
    for (const c of data.kpiCounts) totalsByLevel[c.level as Level] = c._count._all;

    const buildLevel = (level: Level) => {
      const row = data.progressRows.find((p) => p.level === level);
      const total = totalsByLevel[level] || 1;
      const answered = row?.lastQuestionIndex ?? 0;
      return {
        status: row?.status ?? ProgressStatus.NOT_STARTED,
        lastQuestionIndex: answered,
        completionPct: Math.min(100, Math.round((answered / total) * 100)),
      };
    };

    return NextResponse.json({
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        totpEnabled: data.user.totpEnabled,
        // Always emit the effective levels so admins/SOLO see [P, Pr, C] even
        // if the column drifts. Mobile uses this to gate the assessment UI.
        allowedLevels: effectiveAllowedLevels({
          role: data.user.role,
          orgMode: data.user.org.mode,
          allowedLevels: data.user.allowedLevels,
        }),
      },
      org: data.user.org,
      progress: {
        people: buildLevel('PEOPLE'),
        process: buildLevel('PROCESS'),
        company: buildLevel('COMPANY'),
      },
      latestScorecard: data.snapshot
        ? {
            id: data.snapshot.id,
            peopleScore: data.snapshot.peopleScore,
            processScore: data.snapshot.processScore,
            companyScore: data.snapshot.companyScore,
            overallScore: data.snapshot.overallScore,
            completeness: data.snapshot.completeness,
            generatedAt: data.snapshot.generatedAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    return internalError(err, { route: 'auth/me' });
  }
}
