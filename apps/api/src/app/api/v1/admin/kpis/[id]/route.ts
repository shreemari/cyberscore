import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InputType, KpiStatus, Level, TierCondition, ErrorCodes } from '@cymetric/types';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { parseJson, problem, internalError } from '@/lib/problem';
import { audit, AuditActions } from '@/lib/audit';
import { invalidateKpiCache } from '../../../kpis/route';

// PATCH /api/v1/admin/kpis/:id — edit a KPI + its tiers.
// DELETE /api/v1/admin/kpis/:id — soft-delete (sets deletedAt + isActive=false).
//
// Every PATCH that lands bumps `version` and snapshots the previous row into
// kpi_versions so historical responses remain auditable against the KPI
// definition that scored them.

const UpdateKpiRequest = z.object({
  kpiName: z.string().min(4).max(200).optional(),
  level: z.nativeEnum(Level).optional(),
  maxScore: z.number().int().positive().optional(),
  weightage: z.number().positive().max(10).optional(),
  inputType: z.nativeEnum(InputType).optional(),
  infoText: z.string().min(1).max(2000).optional(),
  nistControlIds: z.array(z.string()).optional(),
  isoControlIds: z.array(z.string()).optional(),
  displayOrder: z.number().int().nonnegative().optional(),
  status: z.nativeEnum(KpiStatus).optional(),
  changeNote: z.string().max(500).optional(),
  tiers: z
    .array(
      z.object({
        tierLabel: z.string().min(1).max(200),
        condition: TierCondition,
        scoreValue: z.number().int().nonnegative(),
        tierOrder: z.number().int().positive(),
      }),
    )
    .min(1)
    .optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const { id } = await params;
  const parsed = await parseJson(req, UpdateKpiRequest);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const before = await prisma.kpi.findFirst({
      where: { id, deletedAt: null },
      include: { tiers: true },
    });
    if (!before) return problem(ErrorCodes.KPI_NOT_FOUND);

    const { tiers, changeNote, ...scalar } = body;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.kpiVersion.create({
        data: {
          kpiId: before.id,
          version: before.version,
          snapshot: before as object,
          changedById: auth.userId,
          changeNote: changeNote ?? null,
        },
      });
      const k = await tx.kpi.update({
        where: { id: before.id },
        data: { ...scalar, version: { increment: 1 } },
      });
      if (tiers) {
        await tx.scoringTier.deleteMany({ where: { kpiId: before.id } });
        await tx.scoringTier.createMany({
          data: tiers.map((t) => ({
            kpiId: before.id,
            tierLabel: t.tierLabel,
            condition: t.condition as object,
            scoreValue: t.scoreValue,
            tierOrder: t.tierOrder,
          })),
        });
      }
      return k;
    });

    void audit({
      action: AuditActions.KPI_UPDATED,
      resource: `kpi:${before.id}`,
      actorId: auth.userId,
      orgId: auth.orgId,
      before: { version: before.version },
      after: { version: updated.version },
      req,
    });
    void invalidateKpiCache();

    return NextResponse.json(updated);
  } catch (err) {
    return internalError(err, { route: 'admin:kpis:update', id });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const { id } = await params;
  try {
    const kpi = await prisma.kpi.findFirst({ where: { id, deletedAt: null } });
    if (!kpi) return problem(ErrorCodes.KPI_NOT_FOUND);

    await prisma.kpi.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, status: 'ARCHIVED' },
    });

    void audit({
      action: AuditActions.KPI_DELETED,
      resource: `kpi:${id}`,
      actorId: auth.userId,
      orgId: auth.orgId,
      req,
    });
    void invalidateKpiCache();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err, { route: 'admin:kpis:delete', id });
  }
}
