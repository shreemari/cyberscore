import type { ProblemDetails, ErrorCode } from '@cymetric/types';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: ErrorCode | string;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
    this.problem = problem;
  }

  // Convenience getter — UI code frequently wants the human-readable title
  // for fallback error toasts ("err.title || 'Something went wrong'").
  // Without this, every callsite has to dig into `err.problem.title`.
  get title(): string {
    return this.problem.title;
  }

  isAuthExpired(): boolean {
    return this.status === 401 && this.code === 'AUTH_TOKEN_EXPIRED';
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Network request failed');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}
