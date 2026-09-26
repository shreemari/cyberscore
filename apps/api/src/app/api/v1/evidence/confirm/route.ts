import { NextResponse } from 'next/server';
import { EvidenceConfirmRequest, ErrorCodes } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { parseJson, problem, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';
import { isAllowedMime, publicUrlFor } from '@/lib/storage';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/evidence/confirm
//
// Called after the mobile app successfully PUTs the file to R2. We verify
// the fileKey belongs to this tenant (prefix check — the key scheme enforces
// orgs/<orgId>/...) and then attach the EvidenceAttachment to the user's
// existing Response for this KPI.
//
// We do NOT re-fetch the object from R2 to check size/type — the presigned
// PUT already enforced both via the signed headers. This keeps the confirm
// call a single round-trip.
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, EvidenceConfirmRequest);
  if (!parsed.ok) return parsed.response;
  const { fileKey, fileName, fileType } = parsed.data;

  if (!fileKey.startsWith(`orgs/${auth.orgId}/`)) {
    return problem(ErrorCodes.FORBIDDEN, { detail: 'fileKey prefix mismatch' });
  }
  if (!isAllowedMime(fileType)) return problem(ErrorCodes.EVIDENCE_INVALID_TYPE);

  // Extract kpiId from the key: orgs/<orgId>/kpis/<kpiId>/<uuid>-<name>
  const parts = fileKey.split('/');
  const kpiId = parts[3];
  if (!kpiId) {
    return problem(ErrorCodes.VALIDATION_FAILED, { detail: 'Malformed fileKey' });
  }

  try {
    const result = await withTenant(auth.orgId, async (tx) => {
      const response = await tx.response.findFirst({
        where: { orgId: auth.orgId, kpiId },
      });
      if (!response) return null;

      const attachment = await tx.evidenceAttachment.create({
        data: {
          responseId: response.id,
          orgId: auth.orgId,
          uploadedById: auth.userId,
          fileName,
          fileKey,
          fileUrl: publicUrlFor(fileKey),
          fileType,
          // R2 confirmed the upload via the signed PUT; we trust the client's
          // size only for display. If we need exact bytes later we can HEAD it.
          fileSize: 0,
        },
      });

      // Mirror the latest evidence URL onto the response for cheap reads.
      await tx.response.update({
        where: { id: response.id },
        data: { evidenceUrl: attachment.fileUrl },
      });

      return attachment;
    });

    if (!result) {
      return problem(ErrorCodes.NOT_FOUND, {
        detail: 'Submit the KPI response before attaching evidence',
      });
    }

    void audit({
      action: AuditActions.EVIDENCE_UPLOADED,
      resource: `evidence:${result.id}`,
      actorId: auth.userId,
      orgId: auth.orgId,
      after: { fileKey, fileName, fileType, kpiId },
      req,
    });

    return NextResponse.json({
      id: result.id,
      responseId: result.responseId,
      fileUrl: result.fileUrl,
      fileKey: result.fileKey,
    });
  } catch (err) {
    return internalError(err, { route: 'evidence:confirm', kpiId });
  }
}
