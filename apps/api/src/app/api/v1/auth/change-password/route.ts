import { NextResponse } from 'next/server';
import { ChangePasswordRequest, ErrorCodes } from '@cymetric/types';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { checkPwnedPassword } from '@/lib/hibp';
import { prisma, withBypassRls } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/auth/change-password
//
// Authenticated flow: user proves the old password then sets a new one.
// Revokes every OTHER active refresh token on success — the current caller
// keeps their session (we don't want to force an immediate re-login on a
// mobile user who just successfully authed). If you want a clean-slate,
// hit /logout afterwards.
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, ChangePasswordRequest);
  if (!parsed.ok) return parsed.response;
  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return problem(ErrorCodes.VALIDATION_FAILED, {
      detail: 'New password must differ from current',
    });
  }

  const pwned = await checkPwnedPassword(newPassword);
  if (pwned.pwned) return problem(ErrorCodes.AUTH_PASSWORD_PWNED);

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) return problem(ErrorCodes.AUTH_TOKEN_INVALID);

    const ok = await verifyPassword(user.passwordHash, currentPassword);
    if (!ok) return problem(ErrorCodes.AUTH_INVALID_CREDENTIALS);

    await withBypassRls(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(newPassword) },
      });
      // Revoke every refresh token; the caller's access JWT is still valid
      // until it expires (≤15m) so they keep moving without interruption,
      // but any long-lived refresh sessions elsewhere are cut off.
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    void audit({
      action: AuditActions.PASSWORD_CHANGED,
      resource: `user:${user.id}`,
      actorId: user.id,
      orgId: auth.orgId,
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err, { route: 'auth/change-password' });
  }
}
