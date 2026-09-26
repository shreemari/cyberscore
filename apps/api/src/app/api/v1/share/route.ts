import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { CreateShareRequest } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { parseJson, internalError } from '@/lib/problem';
import { randomToken } from '@/lib/crypto';
import { env } from '@/lib/env';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/share
//
// Creates a time-boxed share token for vendors / insurers to view the
// scorecard without logging in. The raw token is returned exactly once —
// only a bcrypt hash is stored, so a DB leak doesn't expose live share URLs.
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, CreateShareRequest);
  if (!parsed.ok) return parsed.response;
  const expiresInDays = parsed.data.expiresInDays ?? 30;
  const feedbackText = parsed.data.feedbackText;

  try {
    const raw = randomToken(32);
    const tokenHash = await bcrypt.hash(raw, 10);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const row = await withTenant(auth.orgId, (tx) =>
      tx.shareToken.create({
        data: {
          orgId: auth.orgId,
          tokenHash,
          label: feedbackText?.slice(0, 200) ?? null,
          expiresAt,
        },
      }),
    );

    void audit({
      action: AuditActions.SHARE_CREATED,
      resource: `share:${row.id}`,
      actorId: auth.userId,
      orgId: auth.orgId,
      after: { expiresAt: expiresAt.toISOString() },
      req,
    });

    return NextResponse.json({
      token: raw,
      shareUrl: `${env.API_BASE_URL}/share/${raw}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    return internalError(err, { route: 'share:create' });
  }
}
