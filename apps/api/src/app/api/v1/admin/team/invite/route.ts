import { NextResponse } from 'next/server';
import {
  CreateInviteRequest,
  ErrorCodes,
  InviteStatus,
  Level,
  OrgMode,
  Role,
  type CreateInviteResponse,
} from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { rateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/require-admin';
import { audit, AuditActions } from '@/lib/audit';
import { issueInvite, inviteUrlFor } from '@/lib/invites';
import { enqueueInviteEmail } from '@/lib/queue';

// POST /api/v1/admin/team/invite
//
// Admin issues an invite. Idempotent on (orgId, email): if a PENDING invite
// already exists, it's revoked and replaced so the admin can resend without
// orphans piling up. Raw token returned exactly once.
//
// Rate limit: 60 invites / hour / org.
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const rl = await rateLimit({
    key: `invite:create:${auth.orgId}`,
    max: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return problem(ErrorCodes.AUTH_RATE_LIMITED, {
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    });
  }

  const parsed = await parseJson(req, CreateInviteRequest);
  if (!parsed.ok) return parsed.response;

  const email = parsed.data.email.trim().toLowerCase();
  // Only ADMIN can mint another ADMIN. (Cuts off privilege escalation by
  // a malicious manager — even though we already gate this route on ADMIN,
  // explicit mirroring keeps the rule local to the handler.)
  const requestedRole = parsed.data.role ?? Role.EMPLOYEE;
  if (requestedRole === Role.ADMIN && auth.role !== Role.ADMIN) {
    return problem(ErrorCodes.FORBIDDEN);
  }

  // Default to all three levels if admin didn't specify. ADMINs always get
  // every level regardless of what's persisted, so we don't bother gating here.
  const allowedLevels =
    parsed.data.allowedLevels && parsed.data.allowedLevels.length > 0
      ? Array.from(new Set(parsed.data.allowedLevels))
      : [Level.PEOPLE, Level.PROCESS, Level.COMPANY];

  try {
    const issued = issueInvite();

    const result = await withTenant(auth.orgId, async (tx) => {
      const org = await tx.organisation.findUnique({
        where: { id: auth.orgId },
        select: { mode: true, orgName: true },
      });
      if (!org || org.mode !== OrgMode.ENTERPRISE) {
        return { kind: 'not_enterprise' as const };
      }

      // If the email already belongs to a user in this org, no point inviting.
      const existingUser = await tx.user.findFirst({
        where: { orgId: auth.orgId, email, deletedAt: null },
        select: { id: true },
      });
      if (existingUser) return { kind: 'already_member' as const };

      // Replace any prior PENDING invite for this email in this org.
      await tx.invite.updateMany({
        where: { orgId: auth.orgId, email, status: InviteStatus.PENDING },
        data: { status: InviteStatus.REVOKED, revokedAt: new Date() },
      });

      const created = await tx.invite.create({
        data: {
          orgId: auth.orgId,
          email,
          role: requestedRole,
          allowedLevels,
          tokenHash: issued.tokenHash,
          expiresAt: issued.expiresAt,
          invitedById: auth.userId,
        },
        select: { id: true, email: true, role: true, allowedLevels: true, expiresAt: true },
      });

      // Inviter name surfaces in the invite email.
      const inviter = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { name: true },
      });

      return {
        kind: 'ok' as const,
        invite: created,
        inviterName: inviter?.name ?? null,
        orgName: org.orgName,
      };
    });

    if (result.kind === 'not_enterprise') return problem(ErrorCodes.FORBIDDEN);
    if (result.kind === 'already_member') return problem(ErrorCodes.CONFLICT);

    const inviteUrl = inviteUrlFor(issued.rawToken);

    await enqueueInviteEmail({
      email: result.invite.email,
      orgName: result.orgName,
      invitedByName: result.inviterName,
      inviteUrl,
      expiresAt: result.invite.expiresAt.toISOString(),
    });

    await audit({
      action: AuditActions.TEAM_INVITED,
      resource: `invite:${result.invite.id}`,
      orgId: auth.orgId,
      actorId: auth.userId,
      req,
      after: { email, role: requestedRole, allowedLevels },
    });

    const body: CreateInviteResponse = {
      inviteId: result.invite.id,
      email: result.invite.email,
      role: result.invite.role,
      allowedLevels: result.invite.allowedLevels,
      token: issued.rawToken,
      inviteUrl,
      expiresAt: result.invite.expiresAt.toISOString(),
    };
    return NextResponse.json(body);
  } catch (err) {
    return internalError(err, { route: 'admin/team/invite' });
  }
}
