import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { internalError } from '@/lib/problem';

// GET /api/v1/admin/billing
//
// Lists every Subscription row joined to its org. Used by the admin billing
// console to spot PAST_DUE / near-expiry accounts at a glance. Filters:
//   ?status=PAST_DUE    — exact SubscriptionStatus match
//   ?plan=GROWTH        — plan tier
export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  const url = new URL(req.url);
  const status = url.searchParams.get('status')?.trim();
  const plan = url.searchParams.get('plan')?.trim();

  try {
    const subs = await prisma.subscription.findMany({
      where: {
        ...(status && { status: status as never }),
        ...(plan && { plan: plan as never }),
      },
      include: {
        org: {
          select: { id: true, orgName: true, email: true, industry: true },
        },
      },
      orderBy: [{ currentPeriodEnd: 'asc' }],
    });

    return NextResponse.json({
      subscriptions: subs.map((s) => ({
        id: s.id,
        orgId: s.orgId,
        orgName: s.org.orgName,
        email: s.org.email,
        industry: s.org.industry,
        plan: s.plan,
        status: s.status,
        currentPeriodEnd: s.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        stripeSubscriptionId: s.stripeSubscriptionId,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return internalError(err, { route: 'admin:billing:list' });
  }
}
