import { NextResponse } from 'next/server';
import { ErrorCodes } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { problem, internalError } from '@/lib/problem';
import { audit, AuditActions } from '@/lib/audit';

// DELETE /api/v1/share/:id — revoke a share token.
// Revocation is soft (revokedAt) so history remains for audit. The public
// lookup path checks this column and refuses the token even if it's still
// within its TTL.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const { id } = await params;

  try {
    const row = await withTenant(auth.orgId, (tx) =>
      tx.shareToken.findFirst({ where: { id, orgId: auth.orgId } }),
    );
    if (!row) return problem(ErrorCodes.NOT_FOUND);
    if (row.revokedAt) return NextResponse.json({ ok: true, alreadyRevoked: true });

    await withTenant(auth.orgId, (tx) =>
      tx.shareToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date() },
      }),
    );

    void audit({
      action: AuditActions.SHARE_REVOKED,
      resource: `share:${row.id}`,
      actorId: auth.userId,
      orgId: auth.orgId,
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err, { route: 'share:revoke' });
  }
}
