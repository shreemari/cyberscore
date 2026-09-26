import { NextResponse } from 'next/server';
import { VerifyOtpRequest, ErrorCodes } from '@cymetric/types';
import { verifyOtp, OTP_CONFIG } from '@/lib/otp';
import { withBypassRls } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/auth/verify-otp
//
// Verifies the latest unused OTP for an email. Increments attempts on
// failure; marks org.isVerified=true on success. Max 5 attempts per OTP.
export async function POST(req: Request) {
  const rl = await rateLimit({
    key: `otp:ip:${clientIp(req)}`,
    max: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.allowed) return problem(ErrorCodes.AUTH_RATE_LIMITED);

  const parsed = await parseJson(req, VerifyOtpRequest);
  if (!parsed.ok) return parsed.response;
  const { email, code } = parsed.data;

  try {
    const result = await withBypassRls(async (tx) => {
      const record = await tx.otpVerification.findFirst({
        where: { email, used: false },
        orderBy: { createdAt: 'desc' },
      });
      if (!record) return { outcome: 'NOT_FOUND' as const };

      if (record.expiresAt.getTime() < Date.now()) {
        return { outcome: 'EXPIRED' as const };
      }

      if (record.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
        return { outcome: 'MAX_ATTEMPTS' as const };
      }

      const ok = await verifyOtp(code, record.otpHash);
      if (!ok) {
        const updated = await tx.otpVerification.update({
          where: { id: record.id },
          data: { attempts: { increment: 1 } },
          select: { attempts: true },
        });
        return {
          outcome: 'INVALID' as const,
          attemptsRemaining: Math.max(0, OTP_CONFIG.MAX_ATTEMPTS - updated.attempts),
        };
      }

      // Burn the OTP and mark the org verified atomically.
      await tx.otpVerification.update({
        where: { id: record.id },
        data: { used: true },
      });
      const org = await tx.organisation.update({
        where: { email },
        data: { isVerified: true },
        select: { id: true },
      });
      return { outcome: 'OK' as const, orgId: org.id };
    });

    switch (result.outcome) {
      case 'NOT_FOUND':
        return problem(ErrorCodes.AUTH_INVALID_OTP);
      case 'EXPIRED':
        return problem(ErrorCodes.AUTH_OTP_EXPIRED);
      case 'MAX_ATTEMPTS':
        return problem(ErrorCodes.AUTH_OTP_MAX_ATTEMPTS);
      case 'INVALID':
        await audit({
          action: AuditActions.OTP_FAILED,
          resource: `email:${email}`,
          req,
        });
        return NextResponse.json({
          verified: false,
          attemptsRemaining: result.attemptsRemaining,
        });
      case 'OK':
        await audit({
          action: AuditActions.OTP_VERIFIED,
          resource: `organisation:${result.orgId}`,
          orgId: result.orgId,
          req,
        });
        return NextResponse.json({ verified: true, attemptsRemaining: OTP_CONFIG.MAX_ATTEMPTS });
    }
  } catch (err) {
    return internalError(err, { route: 'auth/verify-otp' });
  }
}
