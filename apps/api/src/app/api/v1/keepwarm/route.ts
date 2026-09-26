import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/v1/keepwarm
//
// Internal keep-warm endpoint. Hit by the cron-job.org cron every 2 minutes.
// (The folder was originally _warm but Next.js App Router treats folders
// starting with an underscore as private and silently excludes them from
// routing. Renamed to keepwarm so the route actually resolves.)
// It does two things:
//
//   1. Runs a real (cheap) Postgres query so Neon's compute does not scale
//      to zero on the free tier. SELECT 1 is enough — Neon counts any
//      query as activity.
//
//   2. Fires parallel internal fetches to a handful of the dashboard routes
//      so their separate Vercel serverless functions stay warm. Each one
//      returns a 401 (we send no Authorization header) but the lambda still
//      spins up and stays warm for the next ~5 minutes.
//
// Returns { warmedDb, warmedRoutes: [{ path, status, ms }] } so the cron
// dashboard at console.cron-job.org shows useful timing.
//
// This is NOT linked from anywhere in the app. It is fine for the URL to be
// public — there is nothing sensitive in the response and no expensive work
// happens. Vercel rate-limits abusive callers at the platform level.

export const dynamic = 'force-dynamic';

const HOT_PATHS = [
  '/api/v1/health',
  '/api/v1/auth/me',
  '/api/v1/scorecard',
  '/api/v1/progress',
  '/api/v1/kpis',
  '/api/v1/admin/team',
  '/api/v1/admin/scorecard',
  '/api/v1/notifications',
];

export async function GET(req: Request) {
  const start = Date.now();

  // Run a cheap query to keep Neon awake. The free-tier compute scales
  // to zero after idle, so even with Vercel functions warm, the first
  // DB query of the day pays a 3 to 5 second startup tax. Pinging here
  // every 2 minutes prevents that.
  let warmedDb = false;
  let dbMs = 0;
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbMs = Date.now() - dbStart;
    warmedDb = true;
  } catch (err) {
    // Swallow — we still want to warm the lambdas even if DB is down.
  }

  // Derive base URL from the incoming request so this works both in dev
  // and against the live Vercel host.
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;

  const warmedRoutes = await Promise.all(
    HOT_PATHS.map(async (path) => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${base}${path}`, {
          method: 'GET',
          // No auth header — most of these will 401, but the lambda still
          // spins up. That is exactly what we want for keep-warm.
          cache: 'no-store',
        });
        return { path, status: res.status, ms: Date.now() - t0 };
      } catch (err) {
        return { path, status: 0, ms: Date.now() - t0, error: 'fetch_failed' };
      }
    }),
  );

  return NextResponse.json({
    ok: true,
    region: process.env.VERCEL_REGION ?? 'unknown',
    totalMs: Date.now() - start,
    warmedDb,
    dbMs,
    warmedRoutes,
  });
}
