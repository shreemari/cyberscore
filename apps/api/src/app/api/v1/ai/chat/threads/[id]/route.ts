import { NextResponse } from 'next/server';
import { ErrorCodes, RenameChatThreadRequest } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';

// PATCH /api/v1/ai/chat/threads/:id  — rename
// DELETE /api/v1/ai/chat/threads/:id — soft delete (archivedAt)
//
// Both are scoped to (orgId, userId) so a user can't touch another user's
// threads even if they guess an ID.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;
  const { id } = await params;

  const parsed = await parseJson(req, RenameChatThreadRequest);
  if (!parsed.ok) return parsed.response;

  try {
    const updated = await withTenant(auth.orgId, (tx) =>
      tx.chatThread.updateMany({
        where: { id, orgId: auth.orgId, userId: auth.userId, archivedAt: null },
        data: { title: parsed.data.title.trim().slice(0, 200) },
      }),
    );
    if (updated.count === 0) return problem(ErrorCodes.NOT_FOUND);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err, { route: 'ai/chat/threads:rename' });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;
  const { id } = await params;

  try {
    const updated = await withTenant(auth.orgId, (tx) =>
      tx.chatThread.updateMany({
        where: { id, orgId: auth.orgId, userId: auth.userId, archivedAt: null },
        data: { archivedAt: new Date() },
      }),
    );
    if (updated.count === 0) return problem(ErrorCodes.NOT_FOUND);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err, { route: 'ai/chat/threads:delete' });
  }
}
