import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Role, ErrorCodes } from '@cymetric/types';
import { hashPassword } from '@/lib/auth';
import { randomToken } from '@/lib/crypto';
import { prisma, withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { parseJson, problem, internalError } from '@/lib/problem';
import { audit, AuditActions } from '@/lib/audit';

// POST /api/v1/team/invite
//
// ADMIN-only. Creates a User row with a random throwaway password and
// returns a one-time invite token. The mobile app surfaces the token as a
// deep link; the invitee hits /auth/accept-invite (not yet implemented)
// to set their real password.
//
// For MVP the invite token IS the temporary password — the invitee logs in
// with it, then /me/change-password rotates to something they control.
// Trade-off: simpler than a standalone accept-invite flow, acceptable
// because the token is sent over TLS and rotated on first successful login.

const InviteRequest = z.object({
  email: z.string().email().max(254),
  name: z.string().min(2).max(200),
  role: z.enum([Role.EMPLOYEE, Role.MANAGER]),
});

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;
  if (auth.role !== Role.ADMIN) return problem(ErrorCodes.FORBIDDEN);

  const parsed = await parseJson(req, InviteRequest);
  if (!parsed.ok) return parsed.response;
  const { email, name, role } = parsed.data;

  try {
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash) return problem(ErrorCodes.AUTH_EMAIL_TAKEN);

    const tempPassword = randomToken(24);
    const passwordHash = await hashPassword(tempPassword);

    const user = await withTenant(auth.orgId, (tx) =>
      tx.user.create({
        data: {
          orgId: auth.orgId,
          email,
          name,
          role,
          passwordHash,
        },
      }),
    );

    void audit({
      action: AuditActions.TEAM_INVITED,
      resource: `user:${user.id}`,
      actorId: auth.userId,
      orgId: auth.orgId,
      after: { email, role },
      req,
    });

    return NextResponse.json({
      userId: user.id,
      email,
      tempPassword, // returned ONCE — caller is responsible for delivering it
    });
  } catch (err) {
    return internalError(err, { route: 'team:invite' });
  }
}
