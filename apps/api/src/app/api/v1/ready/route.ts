import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

// GET /api/v1/ready
//
// Kubernetes-style readiness probe. Returns 200 only when both Postgres and
// Redis answer within 500 ms — pods that haven't finished warming up (e.g.
// still opening their Prisma connection pool) stay out of load-balancer
// rotation until this flips green.
//
// Deliberately separate from /health: /health is a liveness + uptime
// endpoint that returns a degraded JSON body even on partial failure.
// /ready is binary: 200 or 503, minimal body, tight timeout, no logging.
export async function GET() {
  const deadline = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('readiness timeout')), 500),
  );

  try {
    await Promise.race([
      Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]),
      deadline,
    ]);
    return NextResponse.json({ ready: true });
  } catch {
    return NextResponse.json({ ready: false }, { status: 503 });
  }
}
