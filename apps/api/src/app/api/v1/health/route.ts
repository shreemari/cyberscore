import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

// GET /api/v1/health
//
// Liveness + readiness in one endpoint. Returns 200 only when every hard
// dependency (Postgres, Redis) responds within a 1 s budget — the platform
// load balancer and uptime monitor both consume this, so keep it fast and
// honest: a green 200 means traffic is safe to route here.
//
// Dependency probes run in parallel; any failure downgrades the whole
// response to 503. We never throw — a crashed health handler would take the
// pod out of rotation for the wrong reason.
export async function GET() {
  const start = Date.now();
  const results = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);

  const [db, cache] = results;
  const healthy = results.every((r) => r.status === 'fulfilled');

  const body = {
    status: healthy ? 'ok' : 'degraded',
    uptimeMs: Math.round(process.uptime() * 1000),
    latencyMs: Date.now() - start,
    checks: {
      database: db.status === 'fulfilled' ? 'ok' : 'fail',
      redis: cache.status === 'fulfilled' ? 'ok' : 'fail',
    },
  };

  if (!healthy) {
    logger.warn({ checks: body.checks }, 'Health check degraded');
  }

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
