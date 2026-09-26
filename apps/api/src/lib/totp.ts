import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';
import { encryptSecret, decryptSecret } from './crypto';

const ISSUER = 'CyMetric';

export interface TotpSetup {
  encryptedSecret: string; // store in users.totpSecret
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export async function generateTotpSetup(accountLabel: string): Promise<TotpSetup> {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });
  const otpauthUrl = totp.toString();
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 256, margin: 1 });
  return {
    encryptedSecret: encryptSecret(secret.base32),
    otpauthUrl,
    qrCodeDataUrl,
  };
}

export function verifyTotpCode(encryptedSecret: string, code: string): boolean {
  try {
    const secret = Secret.fromBase32(decryptSecret(encryptedSecret));
    const totp = new TOTP({
      issuer: ISSUER,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });
    // Allow ±1 window (±30s) to tolerate clock drift.
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}
