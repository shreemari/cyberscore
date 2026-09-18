import pino, { type Logger } from 'pino';
import { env, isProd } from './env';

// Structured JSON logs in production. Pretty in dev for eyeballs.
export const logger: Logger = pino({
  level: isProd ? 'info' : 'debug',
  base: {
    service: 'cymetric-api',
    env: env.NODE_ENV,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.otpHash',
      '*.tokenHash',
      '*.refreshToken',
      '*.accessToken',
      '*.totpSecret',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type { Logger };
