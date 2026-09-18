import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { ErrorCodes, type ErrorCode, type ProblemDetails } from '@cymetric/types';
import { logger } from './logger';

const TYPE_BASE = 'https://cymetric.app/errors';

// Static problem details — any status/code/title combination the API returns.
const CATALOG: Record<ErrorCode, { status: number; title: string }> = {
  AUTH_INVALID_CREDENTIALS: { status: 401, title: 'Invalid email or password' },
  AUTH_EMAIL_TAKEN: { status: 409, title: 'Email already registered' },
  AUTH_EMAIL_NOT_VERIFIED: { status: 403, title: 'Email not verified' },
  AUTH_INVALID_OTP: { status: 400, title: 'Invalid OTP' },
  AUTH_OTP_EXPIRED: { status: 400, title: 'OTP expired' },
  AUTH_OTP_MAX_ATTEMPTS: { status: 429, title: 'Too many OTP attempts' },
  AUTH_TOTP_REQUIRED: { status: 401, title: 'TOTP code required' },
  AUTH_TOTP_INVALID: { status: 401, title: 'Invalid TOTP code' },
  AUTH_TOKEN_EXPIRED: { status: 401, title: 'Access token expired' },
  AUTH_TOKEN_INVALID: { status: 401, title: 'Invalid or missing token' },
  AUTH_REFRESH_REVOKED: { status: 401, title: 'Refresh token revoked' },
  AUTH_RATE_LIMITED: { status: 429, title: 'Too many requests' },
  AUTH_PASSWORD_PWNED: { status: 400, title: 'Password found in breach database' },

  KPI_NOT_FOUND: { status: 404, title: 'KPI not found' },
  KPI_INVALID_INPUT: { status: 400, title: 'Invalid input for KPI' },
  KPI_NO_MATCHING_TIER: { status: 422, title: 'Input does not match any scoring tier' },
  EVIDENCE_TOO_LARGE: { status: 413, title: 'Evidence file too large' },
  EVIDENCE_INVALID_TYPE: { status: 415, title: 'Unsupported evidence file type' },

  AI_BUDGET_EXHAUSTED: { status: 402, title: 'AI budget exhausted for today' },
  AI_DAILY_LIMIT: { status: 429, title: 'Daily AI call limit reached' },
  AI_VALIDATION_FAILED: { status: 502, title: 'AI response failed validation' },
  AI_PROVIDER_ERROR: { status: 502, title: 'AI provider error' },

  ENTERPRISE_DOMAIN_FREE: {
    status: 400,
    title: 'Enterprise mode requires a company email — free providers (Gmail, Yahoo, etc.) are not supported',
  },
  ENTERPRISE_DOMAIN_TAKEN: {
    status: 409,
    title: 'This company domain is already registered',
  },
  ENTERPRISE_DOMAIN_NOT_FOUND: {
    status: 404,
    title: 'No enterprise organisation matches this email domain',
  },
  ENTERPRISE_JOIN_DISABLED: {
    status: 403,
    title: 'This organisation has disabled domain self-join — ask your admin for an invite',
  },
  INVITE_NOT_FOUND: { status: 404, title: 'Invite not found' },
  INVITE_EXPIRED: { status: 410, title: 'Invite expired' },
  INVITE_REVOKED: { status: 410, title: 'Invite revoked' },
  INVITE_ALREADY_ACCEPTED: { status: 409, title: 'Invite already used' },
  INVITE_EMAIL_MISMATCH: {
    status: 409,
    title: 'Invite was issued for a different email',
  },

  VALIDATION_FAILED: { status: 400, title: 'Validation failed' },
  FORBIDDEN: { status: 403, title: 'Forbidden' },
  NOT_FOUND: { status: 404, title: 'Not found' },
  CONFLICT: { status: 409, title: 'Conflict' },
  INTERNAL: { status: 500, title: 'Internal server error' },
};

interface ProblemOptions {
  detail?: string;
  instance?: string;
  errors?: Array<{ path: string; message: string }>;
  traceId?: string;
  headers?: Record<string, string>;
}

export function problem(code: ErrorCode, opts: ProblemOptions = {}): NextResponse {
  const entry = CATALOG[code];
  const body: ProblemDetails = {
    type: `${TYPE_BASE}/${code.toLowerCase().replace(/_/g, '-')}`,
    title: entry.title,
    status: entry.status,
    code,
    ...(opts.detail && { detail: opts.detail }),
    ...(opts.instance && { instance: opts.instance }),
    ...(opts.errors && { errors: opts.errors }),
    ...(opts.traceId && { traceId: opts.traceId }),
  };

  return NextResponse.json(body, {
    status: entry.status,
    headers: {
      'Content-Type': 'application/problem+json',
      ...opts.headers,
    },
  });
}

// Wrap a Zod parse and convert failures to a VALIDATION_FAILED problem.
export async function parseJson<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: problem(ErrorCodes.VALIDATION_FAILED, { detail: 'Body must be valid JSON' }),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, response: problemFromZod(result.error) };
  }
  return { ok: true, data: result.data };
}

export function problemFromZod(err: ZodError): NextResponse {
  return problem(ErrorCodes.VALIDATION_FAILED, {
    errors: err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  });
}

// Last-resort handler for truly unexpected errors in a route.
// Logs with trace context and returns a generic 500 — never leaks internals.
export function internalError(err: unknown, context: Record<string, unknown> = {}): NextResponse {
  const traceId = crypto.randomUUID();
  logger.error({ err, traceId, ...context }, 'Unhandled API error');
  return problem(ErrorCodes.INTERNAL, { traceId });
}
