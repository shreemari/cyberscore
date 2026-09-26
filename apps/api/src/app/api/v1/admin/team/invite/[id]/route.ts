import { NextResponse } from 'next/server';
import { ErrorCodes, InviteStatus } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { problem, internalError } from '@/lib/problem';
import { requireAdmin } from '@/lib/require-admin';
import { audit, AuditActions } from '@/lib/audit';

// DELETE /api/v1/admin/team/invite/:id
//
// Revoke a pending invite. Re-revoking an already-revoked invite is a no-op
// (idempotent — the admin shouldn't have to refresh the team screen first).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const { id } = await params;

  try {
    const result = await withTenant(auth.orgId, async (tx) => {
      const invite = await tx.invite.findFirst({
        where: { id, orgId: auth.orgId },
        select: { id: true, status: true },
      });
      if (!invite) return { kind: 'not_found' as const };
      if (invite.status === InviteStatus.PENDING) {
        await tx.invite.update({
          where: { id: invite.id },
          data: { status: InviteStatus.REVOKED, revokedAt: new Date() },
        });
      }
      return { kind: 'ok' as const };
    });

    if (result.kind === 'not_found') return problem(ErrorCodes.INVITE_NOT_FOUND);

    await audit({
      action: AuditActions.TEAM_REMOVED,
      resource: `invite:${id}`,
      orgId: auth.orgId,
      actorId: auth.userId,
      req,
    });

    return NextResponse.json({ ok: true, inviteId: id });
  } catch (err) {
    return internalError(err, { route: 'admin/team/invite/:id' });
  }
}
