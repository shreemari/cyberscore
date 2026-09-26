import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Framework } from '@prisma/client';
import { ErrorCodes, OrgMode, Role } from '@cymetric/types';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { parseJson, problem, internalError } from '@/lib/problem';

// PATCH /api/v1/me/profile
//
// Accepts partial updates for the current user (name) and their org
// (selectedFramework). Email changes go through a separate verification
// flow (not yet exposed) because they require OTP and we don't want the
// mobile client to think this is a zero-friction change.

const UpdateProfileRequest = z
  .object({
    name: z.string().min(2).max(200).optional(),
    selectedFramework: z.nativeEnum(Framework).optional(),
  })
  .refine((v) => v.name !== undefined || v.selectedFramework !== undefined, {
    message: 'Provide at least one field to update',
  });

export async function PATCH(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, UpdateProfileRequest);
  if (!parsed.ok) return parsed.response;

  const { name, selectedFramework } = parsed.data;

  try {
    // Framework changes are gated for ENTERPRISE orgs: only an ADMIN can
    // flip the company framework, and the org must allow it. SOLO orgs
    // skip the gate (single user is also the admin by definition).
    if (selectedFramework) {
      const orgRow = await prisma.organisation.findUniqueOrThrow({
        where: { id: auth.orgId },
        select: { mode: true, frameworkLocked: true, selectedFramework: true },
      });
      if (orgRow.mode === OrgMode.ENTERPRISE) {
        if (auth.role !== Role.ADMIN) return problem(ErrorCodes.FORBIDDEN);
        // frameworkLocked is informational for now — admins can still flip
        // it. If we ever want a hard lock requiring a separate "unlock"
        // endpoint, re-add the check here.
      }
    }

    const orgSelect = {
      id: true,
      orgName: true,
      industry: true,
      plan: true,
      selectedFramework: true,
      isVerified: true,
      mode: true,
      emailDomain: true,
      joinMode: true,
      frameworkLocked: true,
    } as const;

    const [user, org] = await prisma.$transaction([
      name
        ? prisma.user.update({
            where: { id: auth.userId },
            data: { name },
            select: { id: true, name: true, email: true, role: true, totpEnabled: true },
          })
        : prisma.user.findUniqueOrThrow({
            where: { id: auth.userId },
            select: { id: true, name: true, email: true, role: true, totpEnabled: true },
          }),
      selectedFramework
        ? prisma.organisation.update({
            where: { id: auth.orgId },
            data: { selectedFramework },
            select: orgSelect,
          })
        : prisma.organisation.findUniqueOrThrow({
            where: { id: auth.orgId },
            select: orgSelect,
          }),
    ]);

    return NextResponse.json({ user, org });
  } catch (err) {
    return internalError(err, { route: 'me:profile' });
  }
}
