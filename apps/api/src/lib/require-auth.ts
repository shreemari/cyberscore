import { NextResponse } from 'next/server';
import { ErrorCodes, type Role } from '@cymetric/types';
import { getAuthOrg, tokenFailureReason, type AuthContext } from './auth';
import { problem } from './problem';

// Shared "extract bearer, or return 401 problem" dance. Route handlers do:
//
//   const auth = requireAuth(req);
//   if ('response' in auth) return auth.response;
//   // auth.userId / auth.orgId / auth.role are available here
//
// `expired` is distinguished from `invalid` so the mobile SDK knows
// when to trigger the silent refresh flow.
export function requireAuth(
  req: Request,
): AuthContext | { response: NextResponse } {
  const ctx = getAuthOrg(req);
  if (ctx) return ctx;
  const reason = tokenFailureReason(req);
  const code =
    reason === 'expired' ? ErrorCodes.AUTH_TOKEN_EXPIRED : ErrorCodes.AUTH_TOKEN_INVALID;
  return { response: problem(code) };
}

export function requireRole(
  auth: AuthContext,
  allowed: Role[],
): NextResponse | null {
  if (!allowed.includes(auth.role)) return problem(ErrorCodes.FORBIDDEN);
  return null;
}
