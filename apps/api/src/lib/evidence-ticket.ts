import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env';

export interface EvidenceTicket {
  orgId: string;
  userId: string;
  kpiId: string;
  exp: number;
}

function signature(payload: string): string {
  return createHmac('sha256', env.JWT_SECRET).update('evidence-upload-v1:' + payload).digest('base64url');
}

export function createEvidenceTicket(args: Omit<EvidenceTicket, 'exp'>): string {
  const payload = Buffer.from(JSON.stringify({
    ...args,
    exp: Date.now() + 5 * 60 * 1000,
  }), 'utf8').toString('base64url');
  return payload + '.' + signature(payload);
}

export function verifyEvidenceTicket(token: string): EvidenceTicket | null {
  if (token.length > 2048 || !token.includes('.')) return null;
  const [payload, rawSignature] = token.split('.');
  if (!payload || !rawSignature) return null;
  const expected = Buffer.from(signature(payload), 'utf8');
  const actual = Buffer.from(rawSignature, 'utf8');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as EvidenceTicket;
    if (!data.orgId || !data.userId || !data.kpiId || !Number.isFinite(data.exp) || Date.now() >= data.exp) return null;
    return data;
  } catch {
    return null;
  }
}
