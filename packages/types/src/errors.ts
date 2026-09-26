// RFC 7807 problem+json error shape — every mutating endpoint returns this on failure.

export interface ProblemDetails {
  type: string; // URI reference identifying the problem type
  title: string; // short human-readable summary
  status: number; // HTTP status code
  detail?: string; // human-readable explanation of this occurrence
  instance?: string; // URI identifying the specific occurrence
  code?: string; // machine-readable error code, e.g. 'AUTH_INVALID_OTP'
  errors?: Array<{ path: string; message: string }>; // field-level validation errors
  traceId?: string; // correlates with Sentry / OTel trace
}

// Canonical error codes — mobile can branch on these for UX.
export const ErrorCodes = {
  // Auth
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_INVALID_OTP: 'AUTH_INVALID_OTP',
  AUTH_OTP_EXPIRED: 'AUTH_OTP_EXPIRED',
  AUTH_OTP_MAX_ATTEMPTS: 'AUTH_OTP_MAX_ATTEMPTS',
  AUTH_TOTP_REQUIRED: 'AUTH_TOTP_REQUIRED',
  AUTH_TOTP_INVALID: 'AUTH_TOTP_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_REFRESH_REVOKED: 'AUTH_REFRESH_REVOKED',
  AUTH_RATE_LIMITED: 'AUTH_RATE_LIMITED',
  AUTH_PASSWORD_PWNED: 'AUTH_PASSWORD_PWNED',

  // KPI / scorecard
  KPI_NOT_FOUND: 'KPI_NOT_FOUND',
  KPI_INVALID_INPUT: 'KPI_INVALID_INPUT',
  KPI_NO_MATCHING_TIER: 'KPI_NO_MATCHING_TIER',
  EVIDENCE_TOO_LARGE: 'EVIDENCE_TOO_LARGE',
  EVIDENCE_INVALID_TYPE: 'EVIDENCE_INVALID_TYPE',

  // AI
  AI_BUDGET_EXHAUSTED: 'AI_BUDGET_EXHAUSTED',
  AI_DAILY_LIMIT: 'AI_DAILY_LIMIT',
  AI_VALIDATION_FAILED: 'AI_VALIDATION_FAILED',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',

  // Enterprise / team
  ENTERPRISE_DOMAIN_FREE: 'ENTERPRISE_DOMAIN_FREE',
  ENTERPRISE_DOMAIN_TAKEN: 'ENTERPRISE_DOMAIN_TAKEN',
  ENTERPRISE_DOMAIN_NOT_FOUND: 'ENTERPRISE_DOMAIN_NOT_FOUND',
  ENTERPRISE_JOIN_DISABLED: 'ENTERPRISE_JOIN_DISABLED',
  INVITE_NOT_FOUND: 'INVITE_NOT_FOUND',
  INVITE_EXPIRED: 'INVITE_EXPIRED',
  INVITE_REVOKED: 'INVITE_REVOKED',
  INVITE_ALREADY_ACCEPTED: 'INVITE_ALREADY_ACCEPTED',
  INVITE_EMAIL_MISMATCH: 'INVITE_EMAIL_MISMATCH',

  // General
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
