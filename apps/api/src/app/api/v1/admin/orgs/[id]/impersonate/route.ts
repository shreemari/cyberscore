import { NextResponse } from 'next/server';
import { ErrorCodes, Role } from '@cymetric/types';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { problem, internalError } from '@/lib/problem';
import { signAccessToken } from '@/lib/auth';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/admin/orgs/:id/impersonate
//
// Mints a short-lived access token scoped to the target org so support can
// reproduce an issue. No refresh token is issued — impersonation is capped
// at the JWT's natural TTL (15 min) and every use is audit-logged with the
// admin's actorId so the trail doesn't get lost in the target org's logs.
//
// We impersonate as a representative ADMIN user of that org (first one).
// If the org has no users, we refuse — there's no one to be.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const { id: targetOrgId } = await params;

  try {
    const target = await prisma.organisation.findFirst({
      where: { id: targetOrgId, deletedAt: null },
      select: {
        id: true,
        orgName: true,
        users: {
          where: { deletedAt: null },
          orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
          take: 1,
          select: { id: true, role: true },
        },
      },
    });
    if (!target) return problem(ErrorCodes.NOT_FOUND);
    const actAs = target.users[0];
    if (!actAs) {
      return problem(ErrorCodes.NOT_FOUND, {
        detail: 'Target org has no users to impersonate',
      });
    }

    const { token, expiresAt } = signAccessToken({
      sub: actAs.id,
      orgId: target.id,
      role: actAs.role as Role,
    });

    void audit({
      action: AuditActions.ADMIN_IMPERSONATED,
      resource: `org:${target.id}`,
      actorId: auth.userId,
      orgId: auth.orgId,
      after: { targetOrgId: target.id, targetOrgName: target.orgName, actingAsUserId: actAs.id },
      req,
    });

    return NextResponse.json({
      accessToken: token,
      accessTokenExpiresAt: expiresAt.toISOString(),
      impersonating: {
        orgId: target.id,
        orgName: target.orgName,
        userId: actAs.id,
      },
    });
  } catch (err) {
    return internalError(err, { route: 'admin:orgs:impersonate', targetOrgId });
  }
}
