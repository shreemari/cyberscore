import { NextResponse } from 'next/server';
import { MarkNaRequest, ErrorCodes } from '@cymetric/types';
import { prisma, withTenant } from '@/lib/prisma';
import { parseJson, problem, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';
import { audit, AuditActions } from '@/lib/audit';

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
  const { kpiId, justification, frameworkCode } = parsed.data;

  try {
    const kpi = await prisma.kpi.findFirst({
      where: {
        id: kpiId,
        frameworkCode,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, version: true },
    });
    // A framework mismatch is reported as KPI_NOT_FOUND, just like an
    // unknown or inactive KPI.
    if (!kpi) return problem(ErrorCodes.KPI_NOT_FOUND);

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
