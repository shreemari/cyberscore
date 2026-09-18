import { NextResponse } from 'next/server';
import { MarkNaRequest, ErrorCodes } from '@cymetric/types';
import { prisma, withTenant } from '@/lib/prisma';
import { parseJson, problem, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/kpis/na
//
// Marks a KPI as Not Applicable with a mandatory justification.
// N/A responses contribute zero weight to the scorecard — they neither
// help nor hurt the score, but the justification text is retained for
// auditors and for manager review. Upserts so a user can flip between
// answered and N/A freely.
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, MarkNaRequest);
  if (!parsed.ok) return parsed.response;
  const { kpiId, justification } = parsed.data;

  try {
    const kpi = await prisma.kpi.findFirst({
      where: { id: kpiId, isActive: true, deletedAt: null },
      select: { id: true, version: true },
    });
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
