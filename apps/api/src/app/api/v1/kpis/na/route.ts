import { NextResponse } from 'next/server';
import { MarkNaRequest, ErrorCodes } from '@cymetric/types';
import { prisma, withTenant } from '@/lib/prisma';
import { parseJson, problem, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';
import { audit, AuditActions } from '@/lib/audit';
import { canAssessLevel } from '@/lib/access';
import { frameworkKpiFilter } from '@/lib/framework-kpis';
import { enqueueSnapshot } from '@/lib/queue';
import { logger } from '@/lib/logger';

// POST /api/v1/kpis/na
//
// Marks a KPI as Not Applicable with a mandatory justification.
// The selected framework is checked against the KPI catalogue before
// the N/A response is written.
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, MarkNaRequest);
  if (!parsed.ok) return parsed.response;
  const { kpiId, frameworkCode } = parsed.data;
  const justification = parsed.data.justification.trim();
  if (justification.length < 10) {
    return problem(ErrorCodes.KPI_NO_MATCHING_TIER, {
      detail: 'N/A justification must contain at least 10 non-whitespace characters.',
    });
  }

  try {
    const kpi = await prisma.kpi.findFirst({
      where: {
        id: kpiId,
        ...frameworkKpiFilter(frameworkCode),
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, version: true, level: true },
    });
    // A framework mismatch is reported as KPI_NOT_FOUND, just like an
    // unknown or inactive KPI.
    if (!kpi) return problem(ErrorCodes.KPI_NOT_FOUND);

    // N/A is still an assessment response. Enforce the same per-user
    // level restrictions as the normal submit endpoint.
    const caller = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { role: true, allowedLevels: true, org: { select: { mode: true } } },
    });
    if (!caller) return problem(ErrorCodes.AUTH_TOKEN_INVALID);
    if (!canAssessLevel(
      { role: caller.role, orgMode: caller.org.mode, allowedLevels: caller.allowedLevels },
      kpi.level,
    )) {
      return problem(ErrorCodes.FORBIDDEN, {
        detail: `You don't have access to ${kpi.level} assessments. Ask your admin.`,
      });
    }

    const response = await withTenant(auth.orgId, (tx) =>
      tx.response.upsert({
        where: {
          orgId_kpiId_submittedById: {
            orgId: auth.orgId,
            kpiId,
            submittedById: auth.userId,
          },
        },
        create: {
          orgId: auth.orgId,
          kpiId,
          kpiVersion: kpi.version,
          submittedById: auth.userId,
          inputValue: 'N/A',
          actualScore: 0,
          weightedScore: 0,
          matchedTierId: null,
          isNa: true,
          naJustification: justification,
        },
        update: {
          kpiVersion: kpi.version,
          inputValue: 'N/A',
          actualScore: 0,
          weightedScore: 0,
          matchedTierId: null,
          isNa: true,
          naJustification: justification,
        },
      }),
    );

    void audit({
      action: AuditActions.KPI_NA_MARKED,
      resource: `kpi:${kpiId}`,
      actorId: auth.userId,
      orgId: auth.orgId,
      after: { responseId: response.id, justification },
      req,
    });

    enqueueSnapshot({ orgId: auth.orgId, reason: 'KPI_SUBMITTED' }).catch((err) => {
      logger.warn({ err, orgId: auth.orgId }, 'snapshot enqueue failed');
    });

    return NextResponse.json({
      responseId: response.id,
      kpiId: response.kpiId,
      isNa: true,
      submittedAt: response.submittedAt.toISOString(),
    });
  } catch (err) {
    return internalError(err, { route: 'kpis:na', kpiId });
  }
}
