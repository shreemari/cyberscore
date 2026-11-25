import { NextResponse } from 'next/server';
import { ErrorCodes } from '@cymetric/types';
import { problem, internalError } from '@/lib/problem';
import { resolvePublicShare } from '@/lib/share';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// GET /api/v1/share/public/:token
//
// Unauthenticated read — the token IS the credential. Shared between this
// JSON API and the public HTML landing page at /share/[token]. Returns the
// same scorecard shape as the authed endpoint minus the improvement
// suggestions (vendors don't need our playbook).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const rl = await rateLimit({ key: `share:ip:${clientIp(req)}`, max: 45, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) return new NextResponse(JSON.stringify({ error: 'Too many share views' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  try {
    const payload = await resolvePublicShare(token);
    if (!payload) return problem(ErrorCodes.NOT_FOUND);
    return NextResponse.json(payload);
  } catch (err) {
    return internalError(err, { route: 'share:public' });
  }
}
