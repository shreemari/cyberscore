import type { NextResponse } from 'next/server';
import { Role, ErrorCodes } from '@cymetric/types';
import { requireAuth } from './require-auth';
import { problem } from './problem';
import type { AuthContext } from './auth';

// Single-call "authed + ADMIN" guard for /admin/* routes.
//
//   const auth = requireAdmin(req);
//   if ('response' in auth) return auth.response;
//
// Keeps handlers a straight line and makes the role check uniform — we
// don't want three admin routes each hand-rolling their own 403.
export function requireAdmin(
  req: Request,
): AuthContext | { response: NextResponse } {
  const auth = requireAuth(req);
  if ('response' in auth) return auth;
  if (auth.role !== Role.ADMIN) {
    return { response: problem(ErrorCodes.FORBIDDEN) };
  }
  return auth;
}


// Platform administrators are distinct from organisation administrators.
// Provision IDs through PLATFORM_ADMIN_USER_IDS on the API runtime. A missing
// allow-list fails closed: normal customer admins cannot access global data.
export function requirePlatformAdmin(
  req: Request,
): AuthContext | { response: NextResponse } {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth;
  const ids = new Set((process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',').map(id => id.trim()).filter(Boolean));
  if (!ids.has(auth.userId)) {
    return { response: problem(ErrorCodes.FORBIDDEN) };
  }
  return auth;
}
