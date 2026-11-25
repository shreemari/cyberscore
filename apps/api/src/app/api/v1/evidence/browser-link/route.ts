import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { internalError } from '@/lib/problem';
import { createEvidenceTicket } from '@/lib/evidence-ticket';
import { env } from '@/lib/env';

const Body = z.object({ kpiId: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Valid kpiId required' }, { status: 400 });
  try {
    const exists = await withTenant(auth.orgId, tx =>
      tx.response.findFirst({
        where: { orgId: auth.orgId, submittedById: auth.userId, kpiId: body.data.kpiId },
        select: { id: true },
      }),
    );
    if (!exists) return NextResponse.json({ error: 'Submit a KPI answer before attaching evidence' }, { status: 404 });
    const ticket = createEvidenceTicket({ orgId: auth.orgId, userId: auth.userId, kpiId: body.data.kpiId });
    return NextResponse.json({
      url: `${env.API_BASE_URL.replace(/\/$/, '')}/evidence-upload?ticket=${encodeURIComponent(ticket)}`,
      expiresInSeconds: 300,
    });
  } catch (err) {
    return internalError(err, { route: 'evidence:browser-link' });
  }
}
