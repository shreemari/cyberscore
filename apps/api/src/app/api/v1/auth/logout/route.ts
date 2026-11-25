import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { LogoutRequest } from '@cymetric/types';
import { refreshLookupKey } from '@/lib/auth';
import { withBypassRls } from '@/lib/prisma';
import { parseJson, internalError } from '@/lib/problem';
import { audit, AuditActions } from '@/lib/audit';

// A valid refresh token proves access even when the JWT has expired.
// Returning 204 for missing/old credentials prevents token enumeration.
export async function POST(req: Request) {
  const parsed = await parseJson(req, LogoutRequest);
  if (!parsed.ok) return parsed.response;
  try {
    const revoked = await withBypassRls(async tx => {
      const c = await tx.refreshToken.findUnique({
        where: { lookupKey: refreshLookupKey(parsed.data.refreshToken) },
        select: { id: true, orgId: true, userId: true, tokenHash: true, revokedAt: true },
      });
      if (!c || c.revokedAt || !(await bcrypt.compare(parsed.data.refreshToken, c.tokenHash))) {
        return null;
      }
      await tx.refreshToken.update({
        where: { id: c.id },
        data: { revokedAt: new Date() },
      });
      return { id: c.id, orgId: c.orgId, userId: c.userId };
    });
    if (revoked) {
      await audit({
        action: AuditActions.LOGOUT,
        resource: `refresh_token:${revoked.id}`,
        actorId: revoked.userId,
        orgId: revoked.orgId,
        req,
      });
    }
  } catch (err) {
    return internalError(err, { route: 'auth/logout' });
  }
  return new NextResponse(null, { status: 204 });
}
