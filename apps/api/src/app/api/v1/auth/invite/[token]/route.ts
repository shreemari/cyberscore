import { NextResponse } from 'next/server';
import { ErrorCodes, InviteStatus } from '@cymetric/types';
import { withBypassRls } from '@/lib/prisma';
import { problem, internalError } from '@/lib/problem';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { hashInviteToken } from '@/lib/invites';

// GET /api/v1/auth/invite/:token
// Public preview for the accept-invite landing screen — lets the mobile
// client render "Join Acme Corp as Employee" before the user commits a
// password. Does NOT consume the invite.
//
// Tokens are 32 bytes of crypto.randomBytes; we store SHA-256 (deterministic
// + indexed) instead of bcrypt because token entropy is already 256 bits.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const rl = await rateLimit({
    key: `invite:peek:${clientIp(req)}`,
    max: 30,
    windowMs: 60 * 1000,
  });
  if (!rl.allowed) {
    return problem(ErrorCodes.AUTH_RATE_LIMITED, {
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    });
  }
  if (!token || token.length < 8) return problem(ErrorCodes.INVITE_NOT_FOUND);

  try {
    const tokenHash = hashInviteToken(token);
    const invite = await withBypassRls((tx) =>
      tx.invite.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          email: true,
          role: true,
          allowedLevels: true,
          status: true,
          expiresAt: true,
          invitedBy: { select: { name: true } },
          org: { select: { id: true, orgName: true, industry: true } },
        },
      }),
    );

    if (!invite) return problem(ErrorCodes.INVITE_NOT_FOUND);
    if (invite.status === InviteStatus.ACCEPTED) {
      return problem(ErrorCodes.INVITE_ALREADY_ACCEPTED);
    }
    if (invite.status === InviteStatus.REVOKED) {
      return problem(ErrorCodes.INVITE_REVOKED);
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return problem(ErrorCodes.INVITE_EXPIRED);
    }

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      allowedLevels: invite.allowedLevels,
      org: invite.org,
      invitedByName: invite.invitedBy?.name ?? null,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (err) {
    return internalError(err, { route: 'auth/invite/preview' });
  }
}
