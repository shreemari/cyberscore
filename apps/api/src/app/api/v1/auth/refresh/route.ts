import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import {
  RefreshRequest, ErrorCodes, type Role, type TokenPair,
} from '@cymetric/types';
import { issueTokenPair, refreshLookupKey } from '@/lib/auth';
import { withBypassRls } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { audit, AuditActions } from '@/lib/audit';

// Constant-time indexed lookup avoids scanning unrelated customers' hashes.
// Reuse of a revoked refresh token revokes all other sessions of that user.
export async function POST(req: Request) {
  const rl = await rateLimit({
    key: `refresh:ip:${clientIp(req)}`,
    max: 60,
    windowMs: 60 * 1000,
  });
  if (!rl.allowed) return problem(ErrorCodes.AUTH_RATE_LIMITED);
  const parsed = await parseJson(req, RefreshRequest);
  if (!parsed.ok) return parsed.response;
  const raw = parsed.data.refreshToken;

  try {
    const outcome = await withBypassRls(async (tx): Promise<
      { kind: 'REVOKED' } | { kind: 'REUSED'; userId: string; orgId: string } |
      { kind: 'OK'; tokens: TokenPair; userId: string; orgId: string }
    > => {
      const c = await tx.refreshToken.findUnique({
        where: { lookupKey: refreshLookupKey(raw) },
        select: {
          id: true, userId: true, orgId: true, tokenHash: true,
          revokedAt: true, expiresAt: true,
          user: { select: { role: true, deletedAt: true } },
        },
      });
      if (!c || !(await bcrypt.compare(raw, c.tokenHash))) return { kind: 'REVOKED' };

      if (c.revokedAt) {
        await tx.refreshToken.updateMany({
          where: { userId: c.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { kind: 'REUSED', userId: c.userId, orgId: c.orgId };
      }
      if (c.expiresAt <= new Date() || c.user.deletedAt) return { kind: 'REVOKED' };

      // updateMany acts as a compare-and-swap for concurrent refresh requests.
      const claim = await tx.refreshToken.updateMany({
        where: { id: c.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claim.count !== 1) {
        await tx.refreshToken.updateMany({
          where: { userId: c.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { kind: 'REUSED', userId: c.userId, orgId: c.orgId };
      }

      const tokens = await issueTokenPair({
        userId: c.userId,
        orgId: c.orgId,
        role: c.user.role as Role,
        userAgent: req.headers.get('user-agent') ?? undefined,
        ipAddress: clientIp(req) === 'unknown' ? undefined : clientIp(req),
        tx,
      });
      return { kind: 'OK', tokens, userId: c.userId, orgId: c.orgId };
    });

    if (outcome.kind === 'REUSED') {
      await audit({
        action: AuditActions.REFRESH_REVOKED,
        resource: 'refresh_token:reuse',
        actorId: outcome.userId,
        orgId: outcome.orgId,
        req,
      });
      return problem(ErrorCodes.AUTH_REFRESH_REVOKED);
    }
    if (outcome.kind === 'REVOKED') return problem(ErrorCodes.AUTH_REFRESH_REVOKED);

    await audit({
      action: AuditActions.REFRESH_ROTATED,
      resource: 'refresh_token',
      actorId: outcome.userId,
      orgId: outcome.orgId,
      req,
    });
    return NextResponse.json({ tokens: outcome.tokens });
  } catch (err) {
    return internalError(err, { route: 'auth/refresh' });
  }
}
