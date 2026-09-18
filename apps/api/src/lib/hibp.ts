import { createHash } from 'node:crypto';
import { logger } from './logger';

// HaveIBeenPwned Pwned Passwords API with k-anonymity.
// We send the first 5 chars of the SHA-1, receive back all matching
// suffixes with breach counts, and check locally. The full hash
// never leaves our server.

const HIBP_URL = 'https://api.pwnedpasswords.com/range';
const UA = 'CyMetric/1.0 (+https://cymetric.app)';

export interface PwnedResult {
  pwned: boolean;
  occurrences: number;
}

export async function checkPwnedPassword(plaintext: string): Promise<PwnedResult> {
  const sha1 = createHash('sha1').update(plaintext).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const res = await fetch(`${HIBP_URL}/${prefix}`, {
      headers: { 'User-Agent': UA, 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      // Fail OPEN — blocking registration because HIBP is flaky is worse
      // than allowing a borderline password. We still enforce length etc.
      logger.warn({ status: res.status }, 'HIBP lookup failed — failing open');
      return { pwned: false, occurrences: 0 };
    }
    const body = await res.text();
    for (const line of body.split('\n')) {
      const [sfx, countStr] = line.trim().split(':');
      if (!sfx || !countStr) continue;
      if (sfx === suffix) {
        const count = Number.parseInt(countStr, 10);
        // "Add-Padding" returns zero-count entries as cover traffic —
        // treat those as not pwned.
        if (count > 0) return { pwned: true, occurrences: count };
      }
    }
    return { pwned: false, occurrences: 0 };
  } catch (err) {
    logger.warn({ err }, 'HIBP lookup error — failing open');
    return { pwned: false, occurrences: 0 };
  }
}
