import { env } from './env';
import { logger } from './logger';
import { prisma } from './prisma';

// Expo Push API — https://docs.expo.dev/push-notifications/sending-notifications/
// We send via BullMQ workers, not from the request path. This module
// exposes low-level send helpers used by the worker.

const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo accepts up to 100 per request

export interface ExpoMessage {
  to: string; // ExpoPushToken
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string; // Android notification channel
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export async function sendPush(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  if (messages.length === 0) return [];

  const tickets: ExpoTicket[] = [];
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const res = await fetch(EXPO_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(env.EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      logger.error({ status: res.status }, 'Expo push send failed');
      batch.forEach(() => tickets.push({ status: 'error', message: `HTTP ${res.status}` }));
      continue;
    }
    const body = (await res.json()) as { data?: ExpoTicket[] };
    tickets.push(...(body.data ?? []));
  }

  // Handle common invalid-token errors by deactivating the token.
  const invalid: string[] = [];
  tickets.forEach((ticket, idx) => {
    if (
      ticket.status === 'error' &&
      (ticket.details?.error === 'DeviceNotRegistered' ||
        ticket.details?.error === 'InvalidCredentials')
    ) {
      const token = messages[idx]?.to;
      if (token) invalid.push(token);
    }
  });
  if (invalid.length > 0) {
    await prisma.pushToken.updateMany({
      where: { expoPushToken: { in: invalid } },
      data: { isActive: false },
    });
    logger.info({ count: invalid.length }, 'Deactivated invalid push tokens');
  }

  return tickets;
}

// Convenience: look up all active tokens for an org and send the same payload.
export async function sendToOrg(
  orgId: string,
  payload: Omit<ExpoMessage, 'to'>,
): Promise<number> {
  const tokens = await prisma.pushToken.findMany({
    where: { orgId, isActive: true },
    select: { expoPushToken: true },
  });
  if (tokens.length === 0) return 0;
  const messages = tokens.map((t) => ({ ...payload, to: t.expoPushToken }));
  await sendPush(messages);
  return tokens.length;
}
