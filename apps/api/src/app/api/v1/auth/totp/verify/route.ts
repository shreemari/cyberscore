import { NextResponse } from 'next/server';
import { TotpVerifyRequest, ErrorCodes } from '@cymetric/types';
import { verifyTotpCode } from '@/lib/totp';
import { withTenant } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/auth/totp/verify
//
// Two roles:
//   1. First call after /totp/setup: the user hasn't enabled TOTP yet.
//      A valid code flips totpEnabled=true. From then on login requires it.
//   2. Subsequent calls: used by the setup screen to "re-check" — a no-op
//      for DB state but confirms to the UI the secret is still good.
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, TotpVerifyRequest);
  if (!parsed.ok) return parsed.response;

  try {
    const user = await withTenant(auth.orgId, (tx) =>
      tx.user.findUnique({
        where: { id: auth.userId },
        select: { id: true, totpSecret: true, totpEnabled: true },
      }),
    );
    if (!user || !user.totpSecret) return problem(ErrorCodes.NOT_FOUND);

    if (!verifyTotpCode(user.totpSecret, parsed.data.code)) {
      return problem(ErrorCodes.AUTH_TOTP_INVALID);
    }

    if (!user.totpEnabled) {
      await withTenant(auth.orgId, (tx) =>
        tx.user.update({ where: { id: user.id }, data: { totpEnabled: true } }),
      );
      await audit({
        action: AuditActions.TOTP_ENROLLED,
        resource: `user:${user.id}`,
        actorId: user.id,
        orgId: auth.orgId,
        req,
      });
    }

    return NextResponse.json({ enabled: true });
  } catch (err) {
    return internalError(err, { route: 'auth/totp/verify' });
  }
}
