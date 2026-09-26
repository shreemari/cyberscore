import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { LogoutRequest } from '@cymetric/types';
import { withBypassRls } from '@/lib/prisma';
import { parseJson, internalError } from '@/lib/problem';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/auth/logout
//
// Revokes the caller's refresh token server-side. Mobile is responsible
// for clearing its local expo-secure-store after this returns.
//
// Auth is NOT required — a valid refresh token is the proof. If the
// access token has expired the mobile client can still log out.
// We always return 204 to avoid leaking "was this token valid?" info.
export async function POST(req: Request) {
  const parsed = await parseJson(req, LogoutRequest);
  if (!parsed.ok) return parsed.response;

  try {
    await withBypassRls(async (tx) => {
      const candidates = await tx.refreshToken.findMany({
        where: { revokedAt: null },
        take: 200,
        select: { id: true, orgId: true, tokenHash: true },
      });
      for (const c of candidates) {
        if (await bcrypt.compare(parsed.data.refreshToken, c.tokenHash)) {
          await tx.refreshToken.update({
            where: { id: c.id },
            data: { revokedAt: new Date() },
          });
          await audit({
            action: AuditActions.LOGOUT,
            resource: `refresh_token:${c.id}`,
            orgId: c.orgId,
            req,
          });
          break;
        }
      }
    });
  } catch (err) {
    return internalError(err, { route: 'auth/logout' });
  }

  return new NextResponse(null, { status: 204 });
}
