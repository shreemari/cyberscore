import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@cymetric/types';
import { effectiveAllowedLevels } from '@/lib/access';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { internalError } from '@/lib/problem';
import { audit } from '@/lib/audit';

const UpdateAction = z.object({
  kpiId: z.string().min(1),
  ownerEmail: z.string().email().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED']),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;
  try {
    const items = await withTenant(auth.orgId, async tx => {
      const caller = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { role: true, allowedLevels: true, org: { select: { mode: true } } },
      });
      if (!caller) return null;
      const allowed = effectiveAllowedLevels({
        role: caller.role, allowedLevels: caller.allowedLevels, orgMode: caller.org.mode,
      });
      return tx.improvementAction.findMany({
        where: { orgId: auth.orgId, kpi: { level: { in: allowed } } },
        include: { owner: { select: { id: true, name: true, email: true } } },
        orderBy: { updatedAt: 'desc' },
      });
    });
    if (!items) return NextResponse.json({ error: 'Account not found' }, { status: 401 });
    return NextResponse.json({
      items: items.map((item) => ({
        kpiId: item.kpiId,
        ownerEmail: item.owner?.email ?? null,
        ownerName: item.owner?.name ?? null,
        dueDate: item.dueDate?.toISOString().slice(0, 10) ?? null,
        status: item.status,
        notes: item.notes,
        completedAt: item.completedAt?.toISOString() ?? null,
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    return internalError(err, { route: 'actions:list' });
  }
}

export async function PUT(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;
  const parsed = UpdateAction.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid action fields', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  try {
    const saved = await withTenant(auth.orgId, async (tx) => {
      const caller = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { role: true },
      });
      if (!caller || caller.role !== Role.ADMIN) return { error: 'forbidden' } as const;

      const kpi = await tx.kpi.findFirst({
        where: { id: input.kpiId, isActive: true, deletedAt: null, status: 'PUBLISHED' },
        select: { id: true },
      });
      if (!kpi) return { error: 'kpi' } as const;

      const owner = input.ownerEmail
        ? await tx.user.findFirst({
            where: { orgId: auth.orgId, email: input.ownerEmail, deletedAt: null },
            select: { id: true },
          })
        : null;
      if (input.ownerEmail && !owner) return { error: 'owner' } as const;

      const dueDate = input.dueDate ? new Date(input.dueDate + 'T00:00:00.000Z') : null;
      if (dueDate && Number.isNaN(dueDate.getTime())) return { error: 'date' } as const;
      const completedAt = input.status === 'COMPLETED' ? new Date() : null;
      const previous = await tx.improvementAction.findUnique({
        where: { orgId_kpiId: { orgId: auth.orgId, kpiId: input.kpiId } },
      });
      const action = await tx.improvementAction.upsert({
        where: { orgId_kpiId: { orgId: auth.orgId, kpiId: input.kpiId } },
        create: {
          orgId: auth.orgId,
          kpiId: input.kpiId,
          ownerId: owner?.id ?? null,
          dueDate,
          status: input.status,
          notes: input.notes ?? null,
          completedAt,
        },
        update: {
          ownerId: owner?.id ?? null,
          dueDate,
          status: input.status,
          notes: input.notes ?? null,
          completedAt: input.status === 'COMPLETED' ? (previous?.completedAt ?? completedAt) : null,
        },
      });
      return { action, previous } as const;
    });

    if ('error' in saved) {
      const statuses = { forbidden: 403, kpi: 404, owner: 400, date: 400 };
      return NextResponse.json({ error: saved.error }, { status: statuses[saved.error] });
    }
    await audit({
      action: 'ACTION_UPDATED',
      resource: `action:${input.kpiId}`,
      actorId: auth.userId,
      orgId: auth.orgId,
      before: saved.previous
        ? { ownerId: saved.previous.ownerId, dueDate: saved.previous.dueDate, status: saved.previous.status, notes: saved.previous.notes }
        : null,
      after: { ownerId: saved.action.ownerId, dueDate: saved.action.dueDate, status: saved.action.status, notes: saved.action.notes },
      req,
    });
    return NextResponse.json({ ok: true, kpiId: saved.action.kpiId, status: saved.action.status });
  } catch (err) {
    return internalError(err, { route: 'actions:update' });
  }
}
