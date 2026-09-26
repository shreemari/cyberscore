import argon2 from 'argon2';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import type { JwtPayload, TokenPair, Role } from '@cymetric/types';
import { env } from './env';
import { prisma } from './prisma';
import { randomToken } from './crypto';

// ============================================================
// Passwords — Argon2id per OWASP
// ============================================================
const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTS);
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

// ============================================================
// Access tokens (JWT)
// ============================================================
export function signAccessToken(payload: Pick<JwtPayload, 'sub' | 'orgId' | 'role'>): {
  token: string;
  expiresAt: Date;
} {
  const opts: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  const token = jwt.sign(payload, env.JWT_SECRET, opts);
  const decoded = jwt.decode(token) as JwtPayload;
  return { token, expiresAt: new Date(decoded.exp * 1000) };
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// ============================================================
// Refresh tokens — opaque random strings, hashed at rest
// ============================================================
// Raw token returned to the client only once (in the login/refresh response).
// DB stores a bcrypt hash so a DB leak doesn't grant access.
//
// Lookup strategy: we index refresh tokens by a SHA-256 prefix so we can
// find the right row in O(1) without scanning — then bcrypt-verify to
// constant-time compare. (Pure bcrypt without a lookup key means a full
// table scan on every refresh.)

export interface IssuedRefreshToken {
  raw: string;
  hash: string;
  expiresAt: Date;
}

function parseExpiresIn(spec: string): number {
  // Minimal "Nd" / "Nh" / "Nm" parser — avoid dragging in `ms` just for this.
  const m = spec.match(/^(\d+)([dhms])$/);
  if (!m) throw new Error(`Bad expires spec: ${spec}`);
  const n = Number(m[1]);
  const unit = m[2];
  const sec =
    unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;
  return n * sec * 1000;
}

export async function issueRefreshToken(): Promise<IssuedRefreshToken> {
  const raw = randomToken(48);
  const hash = await bcrypt.hash(raw, 10);
  const expiresAt = new Date(Date.now() + parseExpiresIn(env.REFRESH_TOKEN_EXPIRES_IN));
  return { raw, hash, expiresAt };
}

// SHA-256 of the raw token — non-secret, used only as a DB lookup index.
// (The authoritative check is still bcrypt.compare on `tokenHash`.)
export function refreshLookupKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function verifyRefreshToken(raw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(raw, hash);
}

// ============================================================
// Token pair factory — issues JWT + refresh + persists refresh row
// ============================================================
export async function issueTokenPair(args: {
  userId: string;
  orgId: string;
  role: Role;
  userAgent?: string;
  ipAddress?: string;
}): Promise<TokenPair> {
  const access = signAccessToken({ sub: args.userId, orgId: args.orgId, role: args.role });
  const refresh = await issueRefreshToken();

  await prisma.refreshToken.create({
    data: {
      orgId: args.orgId,
      userId: args.userId,
      tokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
      userAgent: args.userAgent?.slice(0, 512),
      ipAddress: args.ipAddress?.slice(0, 64),
    },
  });

  return {
    accessToken: access.token,
    refreshToken: refresh.raw,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
  };
}

// Revoke every active refresh token for an org — called on password change.
export async function revokeAllRefreshTokens(orgId: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: { orgId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

// ============================================================
// Auth context — reads Bearer token from request headers
// ============================================================
export interface AuthContext {
  userId: string;
  orgId: string;
  role: Role;
}

export function extractBearer(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

// Returns the decoded auth context or null if missing/invalid/expired.
// Route handlers call this and return a 401 problem on null.
export function getAuthOrg(req: Request): AuthContext | null {
  const token = extractBearer(req);
  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  return {
    userId: payload.sub,
    orgId: payload.orgId,
    role: payload.role,
  };
}

// Distinguish "no token" from "expired token" so the mobile client
// knows when to trigger the refresh flow vs. send user to login.
export function tokenFailureReason(req: Request): 'missing' | 'expired' | 'invalid' {
  const token = extractBearer(req);
  if (!token) return 'missing';
  try {
    jwt.verify(token, env.JWT_SECRET);
    return 'invalid'; // verified but we hit this branch? unreachable — belt and braces
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) return 'expired';
    return 'invalid';
  }
}
