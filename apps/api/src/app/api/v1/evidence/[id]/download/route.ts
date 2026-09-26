import { NextResponse } from 'next/server';
import { ErrorCodes } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { problem, internalError } from '@/lib/problem';
import { presignEvidenceDownload } from '@/lib/storage';

// GET /api/v1/evidence/:id/download
//
// Returns a short-lived presigned GET URL so the mobile viewer can fetch
// the evidence file directly from R2. RLS guarantees we only hit rows for
// the caller's org, and the fileKey scheme further pins the download to
// that tenant's prefix.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const { id } = await params;

  try {
    const evidence = await withTenant(auth.orgId, (tx) =>
      tx.evidenceAttachment.findFirst({
        where: { id, orgId: auth.orgId },
        select: { id: true, fileKey: true, fileName: true, fileType: true },
      }),
    );
    if (!evidence) return problem(ErrorCodes.NOT_FOUND);

    const { url, expiresAt } = await presignEvidenceDownload({
      key: evidence.fileKey,
    });

    return NextResponse.json({
      url,
      fileName: evidence.fileName,
      fileType: evidence.fileType,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    return internalError(err, { route: 'evidence:download', id });
  }
}
