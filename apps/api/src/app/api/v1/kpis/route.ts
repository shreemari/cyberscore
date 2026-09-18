import { NextResponse } from 'next/server';
import type { Level } from '@cymetric/types';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { requireAuth } from '@/lib/require-auth';
import { internalError } from '@/lib/problem';
import { logger } from '@/lib/logger';
import { effectiveAllowedLevels } from '@/lib/access';

// GET /api/v1/kpis
//
// Returns every active, published KPI with its tiers, ordered by displayOrder
// so mobile can render the question flow in the intended sequence.
//
// Redis-cached for 5 min keyed on (level, framework) — KPI catalogue changes
// rarely (admin-only) but mobile reads it on every launch, so a cache hit
// is the common path. Admin mutations (POST/PATCH/DELETE on /admin/kpis)
// bust the key via CACHE_KEY_PREFIX below.
//
// Cursor-less today — 46 rows is small enough that paging only adds mobile
// complexity. If the catalogue grows past ~200 we'll switch to (displayOrder, id)
// cursors; the response shape already carries `cursor: null` for forward compat.

export const KPI_CACHE_PREFIX = 'kpis:list:';
const CACHE_TTL_SEC = 300;

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const url = new URL(req.url);
  const level = url.searchParams.get('level')?.trim() ?? 'all';
  const framework = url.searchParams.get('framework')?.trim() ?? 'all';
  const cacheKey = `${KPI_CACHE_PREFIX}${level}:${framework}`;

  // Resolve caller's effective allowed levels — used to gate the response
  // for ENTERPRISE_EMPLOYEE / MANAGER. Admins and SOLO orgs see everything.
  const callerLevels = await prisma.user
    .findUnique({
      where: { id: auth.userId },
      select: {
        allowedLevels: true,
        role: true,
        org: { select: { mode: true } },
      },
    })
    .then((u) =>
      u
        ? effectiveAllowedLevels({
            role: u.role,
            orgMode: u.org.mode,
            allowedLevels: u.allowedLevels,
          })
        : null,
    );
  if (!callerLevels) return internalError(new Error('user not found'), { route: 'kpis:list' });
  const allowedSet = new Set<Level>(callerLevels);

  try {
    const hit = await redis.get(cacheKey).catch(() => null);
    if (hit) {
      const parsed = JSON.parse(hit) as { items: Array<{ level: Level }>; total: number; cursor: null };
      const filtered = parsed.items.filter((k) => allowedSet.has(k.level));
      return NextResponse.json(
        { items: filtered, total: filtered.length, cursor: null },
        { headers: { 'X-Cache': 'HIT' } },
      );
    }

    const kpis = await prisma.kpi.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        status: 'PUBLISHED',
        ...(level !== 'all' && { level: level as never }),
        ...(framework !== 'all' && { frameworkCode: framework as never }),
      },
      orderBy: [{ displayOrder: 'asc' }, { kpiName: 'asc' }],
      include: {
        tiers: { orderBy: { tierOrder: 'asc' } },
      },
    });

    const payload = {
      items: kpis.map((k) => ({
        id: k.id,
        kpiName: k.kpiName,
        level: k.level,
        maxScore: k.maxScore,
        weightage: k.weightage,
        inputType: k.inputType,
        infoText: k.infoText,
        frameworkCode: k.frameworkCode,
        nistControlIds: k.nistControlIds,
        isoControlIds: k.isoControlIds,
        isCustom: k.isCustom,
        isActive: k.isActive,
        version: k.version,
        answerScope: k.answerScope,
        tiers: k.tiers.map((t) => ({
          id: t.id,
          tierLabel: t.tierLabel,
          condition: t.condition,
          scoreValue: t.scoreValue,
          tierOrder: t.tierOrder,
        })),
      })),
      total: kpis.length,
      cursor: null,
    };

    const serialised = JSON.stringify(payload);
    // Cache the unfiltered list — different users with different allowedLevels
    // share the same cache key. We filter per-request after a cache read.
    redis.set(cacheKey, serialised, 'EX', CACHE_TTL_SEC).catch((err) => {
      logger.warn({ err, cacheKey }, 'kpis cache write failed');
    });

    const filteredItems = payload.items.filter((k) => allowedSet.has(k.level as Level));
    return NextResponse.json(
      { items: filteredItems, total: filteredItems.length, cursor: null },
      { headers: { 'X-Cache': 'MISS' } },
    );
  } catch (err) {
    return internalError(err, { route: 'kpis:list' });
  }
}

// Export for admin mutations to invalidate — kept as a loose contract; admin
// routes call this with a `redis.keys('kpis:list:*')` + `del` sweep.
export async function invalidateKpiCache(): Promise<void> {
  try {
    const keys = await redis.keys(`${KPI_CACHE_PREFIX}*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    logger.warn({ err }, 'kpi cache invalidation failed');
  }
}
