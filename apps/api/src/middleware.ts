import { NextResponse, type NextRequest } from 'next/server';

// CORS middleware for dev — mobile web bundle runs on :8081 and hits the API
// on :3000, so the browser enforces CORS. Native iOS/Android don't care, but
// opening the Expo web target needs these headers to reach auth/*.
//
// We reflect the Origin header (dev-only) instead of hardcoding, because the
// Expo dev server may pick a different LAN IP or port between runs.
export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '*';

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  const res = NextResponse.next();
  const headers = corsHeaders(origin);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Idempotency-Key, X-Request-Id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export const config = {
  matcher: '/api/:path*',
};
