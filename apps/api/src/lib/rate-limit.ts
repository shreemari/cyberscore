import { redis } from './redis';

// Fixed-window counter in Redis. Good enough for auth brute-force
// protection — spec calls for 5 attempts / 15 min per IP on login.
//
// For tighter guarantees (no burst at window edges) we'd use a sliding
// window log. Not worth the extra Redis ops for this use case.

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSec: number;
}

export async function rateLimit(args: {
  key: string;
  max: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const { key, max, windowMs } = args;
  const bucket = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
  const ttlSec = Math.ceil(windowMs / 1000);

  // Atomic INCR + EXPIRE (only first caller sets TTL via NX).
  const pipeline = redis.multi();
  pipeline.incr(bucket);
  pipeline.expire(bucket, ttlSec, 'NX');
  const [incrResult] = (await pipeline.exec()) ?? [];
  const count = Number(incrResult?.[1] ?? 0);

  const remaining = Math.max(0, max - count);
  const resetAt = new Date(
    (Math.floor(Date.now() / windowMs) + 1) * windowMs,
  );
  const retryAfterSec = Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

  return {
    allowed: count <= max,
    remaining,
    resetAt,
    retryAfterSec,
  };
}

// Helper to extract client IP from Next.js request (behind a proxy / CDN).
// Trust x-forwarded-for in prod; fall back to direct.
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown';
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}
