import { NextResponse, type NextRequest } from 'next/server';

// Browser CORS is explicitly configured in production. Native mobile clients
// do not send Origin and are unaffected. No wildcard + credentials combination.
const METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const HEADERS = 'Content-Type, Authorization, X-Idempotency-Key, X-Request-Id';

function allowedOrigin(origin: string): boolean {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return true;
  if (process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      return ['localhost', '127.0.0.1'].includes(url.hostname) &&
        ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }
  return false;
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowed = origin ? allowedOrigin(origin) : false;
  if (req.method === 'OPTIONS' && origin && !allowed) {
    return new NextResponse(null, { status: 403, headers: { Vary: 'Origin' } });
  }

  const response = req.method === 'OPTIONS'
    ? new NextResponse(null, { status: 204 })
    : NextResponse.next();

  response.headers.set('Vary', 'Origin');
  if (allowed && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', METHODS);
    response.headers.set('Access-Control-Allow-Headers', HEADERS);
    response.headers.set('Access-Control-Max-Age', '3600');
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
