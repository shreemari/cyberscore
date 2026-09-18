import { NextResponse } from 'next/server';
import {
  AcceptInviteRequest,
  ErrorCodes,
  InviteStatus,
} from '@cymetric/types';
import { hashPassword, issueTokenPair } from '@/lib/auth';
import { checkPwnedPassword } from '@/lib/hibp';
import { withBypassRls } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { audit, AuditActions } from '@/lib/audit';
import { hashInviteToken } from '@/lib/invites';

// POST /api/v1/auth/accept-invite
//
// Token-based invite acceptance. Creates the User row, marks the invite
// ACCEPTED, and returns a fresh token pair so the mobile app lands the
// employee straight into the authenticated experience (no separate login
// step — they already proved the email by clicking the invite link).
//
// Rate limit: 20 attempts / 15min / IP — guards against token guessing.
export async function POST(req: Request) {
  const rl = await rateLimit({
    key: `accept-invite:${clientIp(req)}`,
    max: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.allowed) {
    return problem(ErrorCodes.AUTH_RATE_LIMITED, {
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    });
  }

  const parsed = await parseJson(req, AcceptInviteRequest);
  if (!parsed.ok) return parsed.response;
  const { token, name, password } = parsed.data;

  const pwned = await checkPwnedPassword(password);
  if (pwned.pwned) return problem(ErrorCodes.AUTH_PASSWORD_PWNED);

  try {
    const tokenHash = hashInviteToken(token);
    const passwordHash = await hashPassword(password);

    const result = await withBypassRls(async (tx) => {
      const invite = await tx.invite.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          orgId: true,
          email: true,
          role: true,
          allowedLevels: true,
          status: true,
          expiresAt: true,
        },
      });

      if (!invite) return { kind: 'not_found' as const };
      if (invite.status === InviteStatus.ACCEPTED) return { kind: 'already_accepted' as const };
      if (invite.status === InviteStatus.REVOKED) return { kind: 'revoked' as const };
      if (invite.expiresAt.getTime() < Date.now()) {
        // Mark expired so we don't keep evaluating the row.
        await tx.invite.update({
          where: { id: invite.id },
          data: { status: InviteStatus.EXPIRED },
        });
        return { kind: 'expired' as const };
      }

      // If the email already has an account, refuse — accepting would either
      // overwrite credentials or silently re-link, both surprising. Admin
      // should revoke + re-invite to a fresh email if needed.
      if (await tx.user.findUnique({ where: { email: invite.email }, select: { id: true } })) {
        return { kind: 'email_taken' as const };
      }

      const user = await tx.user.create({
        data: {
          orgId: invite.orgId,
          name,
          email: invite.email,
          passwordHash,
          role: invite.role,
          allowedLevels: invite.allowedLevels,
        },
        select: { id: true, role: true, orgId: true },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: {
          status: InviteStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedById: user.id,
        },
      });

      return { kind: 'ok' as const, invite, user };
    });

    if (result.kind === 'not_found') return problem(ErrorCodes.INVITE_NOT_FOUND);
    if (result.kind === 'already_accepted') return problem(ErrorCodes.INVITE_ALREADY_ACCEPTED);
    if (result.kind === 'revoked') return problem(ErrorCodes.INVITE_REVOKED);
    if (result.kind === 'expired') return problem(ErrorCodes.INVITE_EXPIRED);
    if (result.kind === 'email_taken') return problem(ErrorCodes.AUTH_EMAIL_TAKEN);

    const tokens = await issueTokenPair({
      userId: result.user.id,
      orgId: result.user.orgId,
      role: result.user.role,
      userAgent: req.headers.get('user-agent') ?? undefined,
      ipAddress: clientIp(req),
    });

    await audit({
      action: AuditActions.REGISTER,
      resource: `user:${result.user.id}`,
      orgId: result.user.orgId,
      actorId: result.user.id,
      req,
      after: {
        email: result.invite.email,
        role: result.user.role,
        joinedVia: 'INVITE',
        inviteId: result.invite.id,
      },
    });

    return NextResponse.json({
      inviteId: result.invite.id,
      orgId: result.user.orgId,
      userId: result.user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    });
  } catch (err) {
    return internalError(err, { route: 'auth/accept-invite' });
  }
}
