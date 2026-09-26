import { NextResponse } from 'next/server';
import { PushTokenRequest } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { parseJson, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';

// POST /api/v1/auth/push-token
//
// Mobile calls this once after the user grants notification permission.
// Idempotent — re-registering the same device updates the token.
// (Expo reissues tokens periodically; the mobile SDK just replays this call.)
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, PushTokenRequest);
  if (!parsed.ok) return parsed.response;
  const { expoPushToken, deviceId, platform } = parsed.data;

  try {
    await withTenant(auth.orgId, (tx) =>
      tx.pushToken.upsert({
        where: {
          userId_deviceId: { userId: auth.userId, deviceId },
        },
        update: {
          expoPushToken,
          platform: platform === 'ios' ? 'IOS' : 'ANDROID',
          isActive: true,
          lastSeenAt: new Date(),
        },
        create: {
          orgId: auth.orgId,
          userId: auth.userId,
          expoPushToken,
          deviceId,
          platform: platform === 'ios' ? 'IOS' : 'ANDROID',
        },
      }),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err, { route: 'auth/push-token' });
  }
}
