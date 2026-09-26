import { NextResponse } from 'next/server';
import { PasswordResetConfirmRequest, ErrorCodes } from '@cymetric/types';
import { hashPassword } from '@/lib/auth';
import { checkPwnedPassword } from '@/lib/hibp';
import { verifyOtp, OTP_CONFIG } from '@/lib/otp';
import { withBypassRls } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/auth/password-reset/confirm
//
// Verifies the PASSWORD_RESET OTP, updates the ADMIN user's password, and
// revokes every refresh token on the org so existing sessions lose access.
// The caller must re-login with the new credentials.
export async function POST(req: Request) {
  const rl = await rateLimit({
    key: `pwreset-confirm:ip:${clientIp(req)}`,
    max: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.allowed) return problem(ErrorCodes.AUTH_RATE_LIMITED);

  const parsed = await parseJson(req, PasswordResetConfirmRequest);
  if (!parsed.ok) return parsed.response;
  const { email, code, newPassword } = parsed.data;

  const pwned = await checkPwnedPassword(newPassword);
  if (pwned.pwned) return problem(ErrorCodes.AUTH_PASSWORD_PWNED);

  try {
    const result = await withBypassRls(async (tx) => {
      const record = await tx.otpVerification.findFirst({
        where: { email, used: false, purpose: 'PASSWORD_RESET' },
        orderBy: { createdAt: 'desc' },
      });
      if (!record) return { outcome: 'NOT_FOUND' as const };
      if (record.expiresAt.getTime() < Date.now()) return { outcome: 'EXPIRED' as const };
      if (record.attempts >= OTP_CONFIG.MAX_ATTEMPTS) return { outcome: 'MAX_ATTEMPTS' as const };

      const ok = await verifyOtp(code, record.otpHash);
      if (!ok) {
        await tx.otpVerification.update({
          where: { id: record.id },
          data: { attempts: { increment: 1 } },
        });
        return { outcome: 'INVALID' as const };
      }

      await tx.otpVerification.update({
        where: { id: record.id },
        data: { used: true },
      });

      // Email is unique on User; we reset ALL users with this email
      // (in practice only one, but kept robust).
      const user = await tx.user.findUnique({
        where: { email },
        select: { id: true, orgId: true },
      });
      if (!user) return { outcome: 'NOT_FOUND' as const };

      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(newPassword) },
      });

      // Invalidate every active session for this org — defence against
      // a stolen refresh token the attacker might still be holding.
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return { outcome: 'OK' as const, userId: user.id, orgId: user.orgId };
    });

    switch (result.outcome) {
      case 'NOT_FOUND':
        return problem(ErrorCodes.AUTH_INVALID_OTP);
      case 'EXPIRED':
        return problem(ErrorCodes.AUTH_OTP_EXPIRED);
      case 'MAX_ATTEMPTS':
        return problem(ErrorCodes.AUTH_OTP_MAX_ATTEMPTS);
      case 'INVALID':
        return problem(ErrorCodes.AUTH_INVALID_OTP);
      case 'OK':
        await audit({
          action: AuditActions.PASSWORD_CHANGED,
          resource: `user:${result.userId}`,
          actorId: result.userId,
          orgId: result.orgId,
          req,
        });
        return NextResponse.json({ ok: true });
    }
  } catch (err) {
    return internalError(err, { route: 'auth/password-reset/confirm' });
  }
}
