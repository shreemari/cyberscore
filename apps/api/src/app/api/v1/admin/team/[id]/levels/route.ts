import { NextResponse } from 'next/server';
import {
  ErrorCodes,
  Role,
  UpdateMemberLevelsRequest,
  type UpdateMemberLevelsResponse,
} from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { requireAdmin } from '@/lib/require-admin';
import { audit, AuditActions } from '@/lib/audit';

// PATCH /api/v1/admin/team/:userId/levels
//
// Admin reassigns which assessment levels an employee can access. ADMINs
// always have all three levels (the API enforces it elsewhere), so attempts
// to restrict an admin are rejected — promote/demote first if you want that.
//
// Levels are deduped + persisted as-is; an empty array is allowed (locks the
// employee out entirely until reassigned).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const { id: targetUserId } = await params;

  const parsed = await parseJson(req, UpdateMemberLevelsRequest);
  if (!parsed.ok) return parsed.response;
  const allowedLevels = Array.from(new Set(parsed.data.allowedLevels));

  try {
    const result = await withTenant(auth.orgId, async (tx) => {
      const target = await tx.user.findFirst({
        where: { id: targetUserId, orgId: auth.orgId, deletedAt: null },
        select: { id: true, role: true, allowedLevels: true },
      });
      if (!target) return { kind: 'not_found' as const };
      if (target.role === Role.ADMIN) return { kind: 'is_admin' as const };

      const updated = await tx.user.update({
        where: { id: target.id },
        data: { allowedLevels },
        select: { id: true, allowedLevels: true },
      });
      return { kind: 'ok' as const, before: target.allowedLevels, updated };
    });

    if (result.kind === 'not_found') return problem(ErrorCodes.NOT_FOUND);
    if (result.kind === 'is_admin') {
      return problem(ErrorCodes.CONFLICT, {
        detail: 'Admins always have access to every level. Demote first if you want to restrict.',
      });
    }

    await audit({
      action: AuditActions.TEAM_LEVELS_CHANGED,
      resource: `user:${targetUserId}`,
      orgId: auth.orgId,
      actorId: auth.userId,
      req,
      before: { allowedLevels: result.before },
      after: { allowedLevels: result.updated.allowedLevels },
    });

    const body: UpdateMemberLevelsResponse = {
      ok: true,
      userId: result.updated.id,
      allowedLevels: result.updated.allowedLevels,
    };
    return NextResponse.json(body);
  } catch (err) {
    return internalError(err, { route: 'admin/team/:id/levels' });
  }
}
