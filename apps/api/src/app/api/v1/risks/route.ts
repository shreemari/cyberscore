import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@cymetric/types';
import { requireAuth } from '@/lib/require-auth';
import { withTenant } from '@/lib/prisma';
import { internalError } from '@/lib/problem';
import { audit, AuditActions } from '@/lib/audit';

// Risk owners and approval remain within the caller's organisation.
const RiskFields = z.object({
  title: z.string().trim().min(4).max(200),
  description: z.string().trim().min(10).max(5000),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']).default('OPEN'),
  treatment: z.enum(['MITIGATE', 'AVOID', 'TRANSFER', 'ACCEPT']).default('MITIGATE'),
  ownerId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  exceptionReason: z.string().trim().max(4000).nullable().optional(),
  acceptedUntil: z.string().datetime().nullable().optional(),
}).superRefine((v, ctx) => {
  if (v.treatment === 'ACCEPT' &&
      (!v.exceptionReason || v.exceptionReason.length < 10 || !v.acceptedUntil)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['exceptionReason'],
      message: 'Accepting a risk requires a reason and expiration date',
    });
  }
});

const UpdateRisk = RiskFields.and(z.object({ id: z.string().min(1) }));

function mayManage(role: Role) {
  return role === Role.ADMIN || role === Role.MANAGER;
}

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  try {
    const result = await withTenant(auth.orgId, async tx => {
      const user = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { role: true, deletedAt: true },
      });
      if (!user || user.deletedAt || !mayManage(user.role)) return null;
      const records = await tx.riskRecord.findMany({
        where: { orgId: auth.orgId },
        orderBy: [{ riskScore: 'desc' }, { updatedAt: 'desc' }],
        take: 200,
      });
      return records;
    });
    if (!result) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ items: result });
  } catch (err) {
    return internalError(err, { route: 'risks:list' });
  }
}

async function upsert(req: Request, method: 'POST' | 'PATCH') {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = (method === 'PATCH' ? UpdateRisk : RiskFields).safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid risk details', details: parsed.error.flatten() }, { status: 400 });
  }
  const fields = parsed.data;
  const id: string | undefined = 'id' in fields ? fields.id as string : undefined;
  const acceptedUntil = fields.acceptedUntil ? new Date(fields.acceptedUntil) : null;
  const dueDate = fields.dueDate ? new Date(fields.dueDate) : null;
  if (fields.treatment === 'ACCEPT' && (!acceptedUntil || acceptedUntil <= new Date())) {
    return NextResponse.json({ error: 'Risk acceptance expiry must be in the future' }, { status: 400 });
  }
  try {
    const saved = await withTenant(auth.orgId, async tx => {
      const user = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { role: true, deletedAt: true },
      });
      if (!user || user.deletedAt || !mayManage(user.role)) return { error: 403 } as const;
      if (fields.ownerId) {
        const owner = await tx.user.findFirst({
          where: { id: fields.ownerId, orgId: auth.orgId, deletedAt: null },
          select: { id: true },
        });
        if (!owner) return { error: 400 } as const;
      }
      const data = {
        title: fields.title,
        description: fields.description,
        likelihood: fields.likelihood,
        impact: fields.impact,
        riskScore: fields.likelihood * fields.impact,
        status: fields.status,
        treatment: fields.treatment,
        ownerId: fields.ownerId ?? null,
        dueDate,
        exceptionReason: fields.treatment === 'ACCEPT' ? fields.exceptionReason : null,
        acceptedUntil: fields.treatment === 'ACCEPT' ? acceptedUntil : null,
      };
      if (method === 'PATCH') {
        const existing = await tx.riskRecord.findFirst({
          where: { id, orgId: auth.orgId },
          select: { id: true },
        });
        if (!existing) return { error: 404 } as const;
        const record = await tx.riskRecord.update({ where: { id: existing.id }, data });
        return { record, before: existing } as const;
      }
      const record = await tx.riskRecord.create({
        data: { ...data, orgId: auth.orgId, createdById: auth.userId },
      });
      return { record, before: null } as const;
    });
    if ('error' in saved) return NextResponse.json({ error: 'Risk operation not allowed' }, { status: saved.error });
    await audit({
      action: method === 'POST' ? AuditActions.RISK_CREATED : AuditActions.RISK_UPDATED,
      resource: `risk:${saved.record.id}`,
      orgId: auth.orgId,
      actorId: auth.userId,
      after: {
        riskScore: saved.record.riskScore,
        treatment: saved.record.treatment,
        status: saved.record.status,
      },
      req,
    });
    return NextResponse.json(saved.record, { status: method === 'POST' ? 201 : 200 });
  } catch (err) {
    return internalError(err, { route: 'risks:save' });
  }
}

export async function POST(req: Request) {
  return upsert(req, 'POST');
}

export async function PATCH(req: Request) {
  return upsert(req, 'PATCH');
}
