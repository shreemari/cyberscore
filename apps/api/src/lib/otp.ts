import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';

// 6-digit numeric OTP. randomInt is CSPRNG-backed — never use Math.random.
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export function verifyOtp(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export const OTP_CONFIG = {
  EXPIRY_MIN: 10,
  MAX_ATTEMPTS: 5,
  RESEND_COOLDOWN_SEC: 60,
} as const;
