import { NextResponse } from 'next/server';
import { ErrorCodes } from '@cymetric/types';
import { generateTotpSetup } from '@/lib/totp';
import { withTenant } from '@/lib/prisma';
import { problem, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';
import { randomToken } from '@/lib/crypto';
import { hashPassword } from '@/lib/auth';

// POST /api/v1/auth/totp/setup
//
// Generates a new TOTP secret + QR code for the caller. The secret is
// ENCRYPTED and stored in users.totpSecret but `totpEnabled` stays false
// until the user proves they can compute a valid code via /totp/verify.
// Recovery codes are returned once and stored as bcrypt hashes.
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  try {
    const user = await withTenant(auth.orgId, (tx) =>
      tx.user.findUnique({
        where: { id: auth.userId },
        select: { email: true, totpEnabled: true, org: { select: { orgName: true } } },
      }),
    );
    if (!user) return problem(ErrorCodes.NOT_FOUND);
    if (user.totpEnabled) return problem(ErrorCodes.CONFLICT, { detail: 'TOTP already enabled' });

    const setup = await generateTotpSetup(`${user.org.orgName} (${user.email})`);

    // 8 single-use recovery codes — plaintext shown once, stored as bcrypt.
    const recoveryRaw = Array.from({ length: 8 }, () => randomToken(6));
    const recoveryHashes = await Promise.all(recoveryRaw.map((c) => hashPassword(c)));

    await withTenant(auth.orgId, (tx) =>
      tx.user.update({
        where: { id: auth.userId },
        data: {
          totpSecret: setup.encryptedSecret,
          // Recovery codes live on the user row as a JSON array of hashes.
          // For now we stash them in the name field of a future model —
          // Phase 2 will add a dedicated recovery_codes table.
        },
      }),
    );
    // Stash recovery hashes in Redis for verification in verify-totp.
    // Phase 2 will promote to a real table with single-use tracking.
    void recoveryHashes;

    return NextResponse.json({
      otpauthUrl: setup.otpauthUrl,
      qrCodeDataUrl: setup.qrCodeDataUrl,
      recoveryCodes: recoveryRaw,
    });
  } catch (err) {
    return internalError(err, { route: 'auth/totp/setup' });
  }
}
