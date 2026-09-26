import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Framework, InputType, Level, TierCondition } from '@cymetric/types';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { parseJson, internalError } from '@/lib/problem';
import { audit, AuditActions } from '@/lib/audit';
import { invalidateKpiCache } from '../../kpis/route';

// POST /api/v1/admin/kpis — create a custom KPI (admin only).
//
// Admin-authored KPIs are marked isCustom=true so they can be filtered out
// of benchmark aggregates (we can't benchmark metrics only one org defines).
// Tiers are created inline — a KPI without tiers would crash scoring, so we
// reject the request if the array is empty.

const CreateKpiRequest = z.object({
  kpiName: z.string().min(4).max(200),
  level: z.nativeEnum(Level),
  maxScore: z.number().int().positive(),
  weightage: z.number().positive().max(10),
  inputType: z.nativeEnum(InputType),
  infoText: z.string().min(1).max(2000),
  frameworkCode: z.nativeEnum(Framework).default(Framework.EXCEL),
  nistControlIds: z.array(z.string()).default([]),
  isoControlIds: z.array(z.string()).default([]),
  displayOrder: z.number().int().nonnegative().default(999),
  tiers: z
    .array(
      z.object({
        tierLabel: z.string().min(1).max(200),
        condition: TierCondition,
        scoreValue: z.number().int().nonnegative(),
        tierOrder: z.number().int().positive(),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, CreateKpiRequest);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const kpi = await prisma.kpi.create({
      data: {
        kpiName: body.kpiName,
        level: body.level,
        maxScore: body.maxScore,
        weightage: body.weightage,
        inputType: body.inputType,
        infoText: body.infoText,
        frameworkCode: body.frameworkCode,
        nistControlIds: body.nistControlIds,
        isoControlIds: body.isoControlIds,
        displayOrder: body.displayOrder,
        isCustom: true,
        tiers: {
          createMany: {
            data: body.tiers.map((t) => ({
              tierLabel: t.tierLabel,
              condition: t.condition as object,
              scoreValue: t.scoreValue,
              tierOrder: t.tierOrder,
            })),
          },
        },
      },
      include: { tiers: true },
    });

    void audit({
      action: AuditActions.KPI_CREATED,
      resource: `kpi:${kpi.id}`,
      actorId: auth.userId,
      orgId: auth.orgId,
      after: { kpiName: kpi.kpiName, level: kpi.level },
      req,
    });
    void invalidateKpiCache();

    return NextResponse.json(kpi, { status: 201 });
  } catch (err) {
    return internalError(err, { route: 'admin:kpis:create' });
  }
}
