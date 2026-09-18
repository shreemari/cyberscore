import { z } from 'zod';

// Validate environment once at boot. Fail loudly if anything is missing —
// better than a silent null pointer at 3am.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  TOTP_ENCRYPTION_KEY: z
    .string()
    .length(64, 'TOTP_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
    .optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL_PRIMARY: z.string().default('claude-sonnet-4-5'),
  ANTHROPIC_MODEL_FALLBACK: z.string().default('claude-haiku-4-5'),
  ANTHROPIC_DAILY_BUDGET_USD: z.coerce.number().default(50),

  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default('cymetric-evidence'),
  R2_ENDPOINT: z.string().url().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('CyMetric <no-reply@cymetric.app>'),

  EXPO_ACCESS_TOKEN: z.string().optional(),

  SENTRY_DSN: z.string().optional(),

  // Login rate limit. Bumped from 5 to 30 per 15 min per IP because the
  // demo scenario keeps tripping the old limit when the supervisor or
  // tester retries quickly. 30 still kills any realistic brute force
  // attempt (a real attacker would be running thousands per minute, not
  // dozens), but is forgiving enough that an honest human typing the
  // password a few times in a hurry will not get locked out.
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().default(30),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().int().default(15 * 60 * 1000),

  AI_FREE_DAILY_CALLS: z.coerce.number().int().default(20),

  // When true, the chat endpoint routes to the local rule-based advisor
  // (apps/api/src/lib/advisor-local.ts) instead of calling Anthropic. Default
  // is true so dev / demo environments work without an API key + credit
  // balance. Flip to false in prod when you have real budget.
  USE_LOCAL_ADVISOR: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .default(true),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // Avoid `throw` wrapped in an extra Error class — the stack is clearer this way.
  console.error(`[env] Invalid environment variables:\n${issues}`);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
