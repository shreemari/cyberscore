import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenant } from '@/lib/prisma';
import { internalError } from '@/lib/problem';
import { verifyEvidenceTicket } from '@/lib/evidence-ticket';
import { buildEvidenceKey, isAllowedMime, presignEvidenceUpload, publicUrlFor, verifyEvidenceObject } from '@/lib/storage';
import { audit, AuditActions } from '@/lib/audit';

const RequestSchema = z.discriminatedUnion('stage', [
  z.object({
    stage: z.literal('presign'),
    ticket: z.string(),
    fileName: z.string().min(1).max(255),
    fileType: z.string(),
    fileSize: z.number().int().positive().max(20 * 1024 * 1024),
  }),
  z.object({
    stage: z.literal('confirm'),
    ticket: z.string(),
    fileName: z.string().min(1).max(255),
    fileType: z.string(),
    fileKey: z.string().min(1),
  }),
]);

// The mobile device opens a browser file picker with a short-lived HMAC
// ticket. No JWT or refresh token is ever placed in the browser URL.
export async function POST(req: Request) {
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid evidence metadata' }, { status: 400 });
  const input = parsed.data;
  const ticket = verifyEvidenceTicket(input.ticket);
  if (!ticket || !isAllowedMime(input.fileType)) {
    return NextResponse.json({ error: 'Upload link expired or file type not permitted' }, { status: 403 });
  }
  try {
    const response = await withTenant(ticket.orgId, tx => tx.response.findFirst({
      where: { orgId: ticket.orgId, submittedById: ticket.userId, kpiId: ticket.kpiId },
      select: { id: true },
    }));
    if (!response) return NextResponse.json({ error: 'KPI response no longer exists' }, { status: 404 });

    if (input.stage === 'presign') {
      const key = buildEvidenceKey(ticket.orgId, ticket.kpiId, input.fileName);
      const signed = await presignEvidenceUpload({
        key, contentType: input.fileType, contentLength: input.fileSize, expiresSec: 300,
      });
      return NextResponse.json({ ...signed, fileKey: key });
    }

    if (!input.fileKey.startsWith(`orgs/${ticket.orgId}/kpis/${ticket.kpiId}/`)) {
      return NextResponse.json({ error: 'Invalid evidence key' }, { status: 403 });
    }
    const uploadedSize = await verifyEvidenceObject(input.fileKey, input.fileType);
    const item = await withTenant(ticket.orgId, async tx => {
      const attachment = await tx.evidenceAttachment.create({
        data: {
          orgId: ticket.orgId,
          responseId: response.id,
          uploadedById: ticket.userId,
          fileName: input.fileName,
          fileType: input.fileType,
          fileKey: input.fileKey,
          fileUrl: publicUrlFor(input.fileKey),
          fileSize: uploadedSize,
        },
      });
      await tx.response.update({
        where: { id: response.id },
        data: { evidenceUrl: attachment.fileUrl },
      });
      return attachment;
    });
    void audit({
      action: AuditActions.EVIDENCE_UPLOADED,
      resource: `evidence:${item.id}`,
      orgId: ticket.orgId,
      actorId: ticket.userId,
      after: { fileKey: item.fileKey, kpiId: ticket.kpiId },
    });
    return NextResponse.json({ ok: true, id: item.id });
  } catch (err) {
    return internalError(err, { route: 'evidence:browser-upload' });
  }
}
