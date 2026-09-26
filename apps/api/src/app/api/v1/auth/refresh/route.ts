import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import {
  RefreshRequest,
  ErrorCodes,
  type Role,
  type TokenPair,
} from '@cymetric/types';
import { issueTokenPair } from '@/lib/auth';
import { withBypassRls } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/auth/refresh
//
// Rotates the refresh token — old token is immediately revoked, new pair
// is issued. Called automatically by the mobile SDK interceptor on 401.
//
// The raw refresh token is opaque to us; we bcrypt-compare against each
// non-revoked token for this user. In practice a user has at most a handful
// of active devices, so the scan is cheap. For a very high-device-count
// future we'd index by a SHA-256 lookup key alongside bcrypt.
export async function POST(req: Request) {
  const rl = await rateLimit({
    key: `refresh:ip:${clientIp(req)}`,
    max: 60,
    windowMs: 60 * 1000,
  });
  if (!rl.allowed) return problem(ErrorCodes.AUTH_RATE_LIMITED);

  const parsed = await parseJson(req, RefreshRequest);
  if (!parsed.ok) return parsed.response;
  const { refreshToken: raw } = parsed.data;

  try {
    const outcome = await withBypassRls(async (tx): Promise<
      { kind: 'REVOKED' } | { kind: 'OK'; tokens: TokenPair }
    > => {
      // Candidates: non-revoked, unexpired rows. We cap scan width at 200
      // across the whole table (any single user holding that many active
      // refresh tokens would be extraordinary and indicates abuse).
      const candidates = await tx.refreshToken.findMany({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          userId: true,
          orgId: true,
          tokenHash: true,
          user: { select: { role: true, deletedAt: true } },
        },
      });

      for (const c of candidates) {
        // bcrypt.compare is constant-time per input — scanning is fine,
        // the bound above keeps worst-case work sane.
        const match = await bcrypt.compare(raw, c.tokenHash);
        if (!match) continue;
        if (c.user.deletedAt) return { kind: 'REVOKED' };

        // Rotate: revoke the old row, issue a new pair atomically.
        await tx.refreshToken.update({
          where: { id: c.id },
          data: { revokedAt: new Date() },
        });

        const tokens = await issueTokenPair({
          userId: c.userId,
          orgId: c.orgId,
          role: c.user.role as Role,
          userAgent: req.headers.get('user-agent') ?? undefined,
          ipAddress: clientIp(req) === 'unknown' ? undefined : clientIp(req),
        });

        return { kind: 'OK', tokens };
      }

      return { kind: 'REVOKED' };
    });

    if (outcome.kind === 'REVOKED') {
      return problem(ErrorCodes.AUTH_REFRESH_REVOKED);
    }

    await audit({
      action: AuditActions.REFRESH_ROTATED,
      resource: 'refresh_token',
      req,
    });

    return NextResponse.json({ tokens: outcome.tokens });
  } catch (err) {
    return internalError(err, { route: 'auth/refresh' });
  }
}
