import { NextResponse } from 'next/server';
import { ErrorCodes, Role } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { problem, internalError } from '@/lib/problem';
import { requireAdmin } from '@/lib/require-admin';
import { audit, AuditActions } from '@/lib/audit';

// DELETE /api/v1/admin/team/:userId
//
// Remove an employee from the team. Soft-delete (deletedAt) so audit history
// remains intact. Refresh tokens are revoked so they can't keep an active
// session after removal. The admin can't remove themselves; another admin
// has to do it.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const { id: targetUserId } = await params;
  if (targetUserId === auth.userId) {
    return problem(ErrorCodes.CONFLICT, { detail: 'Cannot remove yourself' });
  }

  try {
    const result = await withTenant(auth.orgId, async (tx) => {
      const target = await tx.user.findFirst({
        where: { id: targetUserId, orgId: auth.orgId, deletedAt: null },
        select: { id: true, role: true },
      });
      if (!target) return { kind: 'not_found' as const };

      // Don't let a manager remove an admin; only admins remove admins.
      if (target.role === Role.ADMIN && auth.role !== Role.ADMIN) {
        return { kind: 'forbidden' as const };
      }

      // Refuse to remove the last remaining ADMIN — that orphans the org.
      if (target.role === Role.ADMIN) {
        const adminCount = await tx.user.count({
          where: { orgId: auth.orgId, role: Role.ADMIN, deletedAt: null },
        });
        if (adminCount <= 1) return { kind: 'last_admin' as const };
      }

      await tx.user.update({
        where: { id: target.id },
        data: { deletedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return { kind: 'ok' as const };
    });

    if (result.kind === 'not_found') return problem(ErrorCodes.NOT_FOUND);
    if (result.kind === 'forbidden') return problem(ErrorCodes.FORBIDDEN);
    if (result.kind === 'last_admin') {
      return problem(ErrorCodes.CONFLICT, {
        detail: 'Cannot remove the last admin — promote another user first',
      });
    }

    await audit({
      action: AuditActions.TEAM_REMOVED,
      resource: `user:${targetUserId}`,
      orgId: auth.orgId,
      actorId: auth.userId,
      req,
    });

    return NextResponse.json({ ok: true, userId: targetUserId });
  } catch (err) {
    return internalError(err, { route: 'admin/team/:id' });
  }
}
