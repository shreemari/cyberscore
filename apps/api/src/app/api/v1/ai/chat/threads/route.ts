import { NextResponse } from 'next/server';
import {
  CreateChatThreadRequest,
  type ChatThreadListResponse,
} from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { internalError, parseJson } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';

// GET /api/v1/ai/chat/threads
//
// Lists the caller's own chat threads, newest-updated first. Each row
// includes a short preview of the most recent message so the mobile thread
// list can render without a second round-trip.
export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  try {
    const rows = await withTenant(auth.orgId, (tx) =>
      tx.chatThread.findMany({
        where: {
          orgId: auth.orgId,
          userId: auth.userId,
          archivedAt: null,
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, role: true },
          },
        },
      }),
    );

    const body: ChatThreadListResponse = {
      threads: rows.map((r) => ({
        id: r.id,
        title: r.title,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        lastMessagePreview: r.messages[0]
          ? r.messages[0].content.slice(0, 140)
          : null,
      })),
    };
    return NextResponse.json(body);
  } catch (err) {
    return internalError(err, { route: 'ai/chat/threads:list' });
  }
}

// POST /api/v1/ai/chat/threads
//
// Creates an empty thread. Title defaults to "New chat" — the streaming
// message endpoint upgrades it to a short summary after the first user turn.
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, CreateChatThreadRequest);
  if (!parsed.ok) return parsed.response;

  try {
    const thread = await withTenant(auth.orgId, (tx) =>
      tx.chatThread.create({
        data: {
          orgId: auth.orgId,
          userId: auth.userId,
          title: parsed.data.title?.trim() || 'New chat',
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );

    return NextResponse.json({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      lastMessagePreview: null,
    });
  } catch (err) {
    return internalError(err, { route: 'ai/chat/threads:create' });
  }
}

