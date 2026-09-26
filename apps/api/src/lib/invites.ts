import { createHash } from 'node:crypto';
import { randomToken } from './crypto';

// ============================================================
// Invite tokens
// ============================================================
// Raw token = 32 random bytes (256 bits) base64url-encoded. We don't bcrypt
// these because the entropy is already crackproof; SHA-256 gives a
// deterministic, indexed lookup. The raw token is returned exactly once,
// at creation time, embedded in the inviteUrl that goes to the employee.

const INVITE_TTL_DAYS = 7;

export interface IssuedInvite {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export function issueInvite(): IssuedInvite {
  const rawToken = randomToken(32);
  return {
    rawToken,
    tokenHash: hashInviteToken(rawToken),
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
  };
}

export function hashInviteToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// Build the deep-link URL the employee follows. Uses the `cymetric://`
// scheme so opening it on a device with the app installed routes straight
// to the accept-invite screen via expo-router. A web fallback host can be
// layered on later (Apple universal links + Play asset links) without
// changing the token format.
export function inviteUrlFor(rawToken: string): string {
  // Hardcoded scheme matches app.json -> expo.scheme. Avoid URL() because
  // Node's parser rejects custom schemes without `//host`.
  const escaped = encodeURIComponent(rawToken);
  return `cymetric://invite?t=${escaped}`;
}

