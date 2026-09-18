import { NextResponse } from 'next/server';
import { EvidencePresignRequest, ErrorCodes } from '@cymetric/types';
import { parseJson, problem, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';
import {
  buildEvidenceKey,
  isAllowedMime,
  presignEvidenceUpload,
} from '@/lib/storage';

// POST /api/v1/evidence/presign?kpiId=...
//
// Returns a short-lived (5 min) R2 presigned PUT URL. The mobile app uploads
// the file directly to R2 — never through us — then calls /evidence/confirm
// to link it to a Response.
//
// The key is derived server-side (orgs/<orgId>/kpis/<kpiId>/<uuid>-<name>)
// so a presigned URL can never be replayed against another tenant's prefix,
// even if the client tampered with its copy.
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const url = new URL(req.url);
  const kpiId = url.searchParams.get('kpiId');
  if (!kpiId) {
    return problem(ErrorCodes.VALIDATION_FAILED, {
      detail: 'Query param kpiId is required',
    });
  }

  const parsed = await parseJson(req, EvidencePresignRequest);
  if (!parsed.ok) return parsed.response;
  const { fileName, fileType, fileSize } = parsed.data;

  if (!isAllowedMime(fileType)) return problem(ErrorCodes.EVIDENCE_INVALID_TYPE);

  try {
    const fileKey = buildEvidenceKey(auth.orgId, kpiId, fileName);
    const { url: uploadUrl, headers, expiresAt } = await presignEvidenceUpload({
      key: fileKey,
      contentType: fileType,
      contentLength: fileSize,
    });

    return NextResponse.json({
      uploadUrl,
      fileKey,
      expiresAt: expiresAt.toISOString(),
      method: 'PUT',
      headers,
    });
  } catch (err) {
    return internalError(err, { route: 'evidence:presign', kpiId });
  }
}
