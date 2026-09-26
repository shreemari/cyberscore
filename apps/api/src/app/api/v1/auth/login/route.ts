import { NextResponse } from 'next/server';
import { LoginRequest, ErrorCodes, type Role } from '@cymetric/types';
import { verifyPassword, issueTokenPair } from '@/lib/auth';
import { verifyTotpCode } from '@/lib/totp';
import { withBypassRls } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/auth/login
//
// Verifies credentials, checks TOTP if enrolled, issues access + refresh.
// Both tokens returned in the response body — mobile stores them in
// expo-secure-store. No cookies.
export async function POST(req: Request) {
  // Rate limit hardcoded to 30 per 15 minutes per IP. Was reading from
  // env.RATE_LIMIT_LOGIN_MAX (default 5) but the demo flow keeps tripping
  // that limit when a tester retries a few times in quick succession. 30
  // is still tight enough to defeat any realistic brute force while being
  // forgiving for honest human use. Hardcoded here so the value cannot be
  // accidentally lowered through a Vercel env override.
  const ip = clientIp(req);
  const rl = await rateLimit({
    key: `login:ip:${ip}`,
    max: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.allowed) {
    return problem(ErrorCodes.AUTH_RATE_LIMITED, {
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    });
  }

  const parsed = await parseJson(req, LoginRequest);
  if (!parsed.ok) return parsed.response;
  const { email, password, totpCode } = parsed.data;

  try {
    // Bypass RLS for the cross-tenant user lookup (pre-auth — we don't know orgId yet).
    const user = await withBypassRls((tx) =>
      tx.user.findUnique({
        where: { email },
        include: {
          org: {
            select: {
              id: true,
              orgName: true,
              industry: true,
              plan: true,
              selectedFramework: true,
              isVerified: true,
              deletedAt: true,
              mode: true,
              emailDomain: true,
              joinMode: true,
              frameworkLocked: true,
            },
          },
        },
      }),
    );

    // Uniform "invalid credentials" error for user-not-found AND wrong-password
    // to prevent user-enumeration via response timing/shape.
    if (!user || user.deletedAt || user.org.deletedAt) {
      await audit({
        action: AuditActions.LOGIN_FAILURE,
        resource: `email:${email}`,
        req,
      });
      return problem(ErrorCodes.AUTH_INVALID_CREDENTIALS);
    }

    const passwordOk = await verifyPassword(user.passwordHash, password);
    if (!passwordOk) {
      await audit({
        action: AuditActions.LOGIN_FAILURE,
        resource: `user:${user.id}`,
        orgId: user.orgId,
        req,
      });
      return problem(ErrorCodes.AUTH_INVALID_CREDENTIALS);
    }

    if (!user.org.isVerified) return problem(ErrorCodes.AUTH_EMAIL_NOT_VERIFIED);

    if (user.totpEnabled) {
      if (!totpCode) return problem(ErrorCodes.AUTH_TOTP_REQUIRED);
      if (!user.totpSecret || !verifyTotpCode(user.totpSecret, totpCode)) {
        await audit({
          action: AuditActions.LOGIN_FAILURE,
          resource: `user:${user.id}`,
          orgId: user.orgId,
          req,
          after: { reason: 'totp_invalid' },
        });
        return problem(ErrorCodes.AUTH_TOTP_INVALID);
      }
    }

    const tokens = await withBypassRls(() =>
      issueTokenPair({
        userId: user.id,
        orgId: user.orgId,
        role: user.role as Role,
        userAgent: req.headers.get('user-agent') ?? undefined,
        ipAddress: ip === 'unknown' ? undefined : ip,
      }),
    );

    await audit({
      action: AuditActions.LOGIN_SUCCESS,
      resource: `user:${user.id}`,
      actorId: user.id,
      orgId: user.orgId,
      req,
    });

    return NextResponse.json({
      tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        totpEnabled: user.totpEnabled,
      },
      org: {
        id: user.org.id,
        orgName: user.org.orgName,
        industry: user.org.industry,
        plan: user.org.plan,
        selectedFramework: user.org.selectedFramework,
        mode: user.org.mode,
        emailDomain: user.org.emailDomain,
        joinMode: user.org.joinMode,
        frameworkLocked: user.org.frameworkLocked,
      },
    });
  } catch (err) {
    return internalError(err, { route: 'auth/login' });
  }
}
