import { NextResponse } from 'next/server';
import { PasswordResetRequestRequest, ErrorCodes } from '@cymetric/types';
import { generateOtp, hashOtp, OTP_CONFIG } from '@/lib/otp';
import { withBypassRls } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { enqueueOtpEmail } from '@/lib/queue';
import { audit, AuditActions } from '@/lib/audit';
import { isDev } from '@/lib/env';

// POST /api/v1/auth/password-reset/request
//
// Sends a 6-digit OTP to the email if it exists. Always responds 200 OK
// regardless so we never leak account enumeration — a caller can't tell
// a registered email from a typo.
//
// Rate-limited aggressively by IP (5/hour) because this is a spray target.
export async function POST(req: Request) {
  const rl = await rateLimit({
    key: `pwreset:ip:${clientIp(req)}`,
    max: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return problem(ErrorCodes.AUTH_RATE_LIMITED, {
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    });
  }

  const parsed = await parseJson(req, PasswordResetRequestRequest);
  if (!parsed.ok) return parsed.response;
  const { email } = parsed.data;

  try {
    const code = generateOtp();
    const devOtp = await withBypassRls(async (tx) => {
      const org = await tx.organisation.findUnique({
        where: { email },
        select: { id: true, orgName: true },
      });
      if (!org) return null;

      await tx.otpVerification.create({
        data: {
          email,
          otpHash: await hashOtp(code),
          purpose: 'PASSWORD_RESET',
          expiresAt: new Date(Date.now() + OTP_CONFIG.EXPIRY_MIN * 60 * 1000),
        },
      });

      await enqueueOtpEmail({ email, orgName: org.orgName, code });
      await audit({
        action: AuditActions.OTP_SENT,
        resource: `email:${email}`,
        orgId: org.id,
        req,
      });
      return code;
    });

    return NextResponse.json({
      ok: true,
      otpSent: true,
      ...(isDev && devOtp && { devOtp }),
    });
  } catch (err) {
    return internalError(err, { route: 'auth/password-reset/request' });
  }
}
