import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env';

// AES-256-GCM for field-level encryption at rest (TOTP secrets, recovery codes).
// Key sourced from TOTP_ENCRYPTION_KEY (64 hex chars = 32 bytes). Rotate by
// re-encrypting all rows with the new key under a migration.

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // GCM standard
const TAG_LEN = 16;

function getKey(): Buffer {
  if (!env.TOTP_ENCRYPTION_KEY) {
    throw new Error('TOTP_ENCRYPTION_KEY not set — required for TOTP storage');
  }
  return Buffer.from(env.TOTP_ENCRYPTION_KEY, 'hex');
}

// Returns base64(iv || tag || ciphertext)
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
