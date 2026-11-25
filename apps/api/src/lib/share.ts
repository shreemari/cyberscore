import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { prisma, withBypassRls } from './prisma';
import { aggregate, loadScorecardInputs } from './scorecard';
import type { ScoreRange } from '@cymetric/types';

// Shared token lookup + scorecard payload for public share URLs.
// Called by the JSON API at /api/v1/share/public/:token AND the HTML
// landing page at /share/[token] so both paths see the same data and
// both increment the view counter exactly once per hit.
//
// bcrypt.compare is constant-time w.r.t. the compared hashes; typical
// orgs hold <10 active tokens so scanning all of them is fine. If it
// ever becomes hot we'll add a SHA-256 lookup column alongside the hash.

export interface PublicSharePayload {
  orgName: string;
  industry: string | null;
  peopleScore: number;
  processScore: number;
  companyScore: number;
  overallScore: number;
  completeness: number;
  colorBand: ScoreRange;
  levelBreakdown: ReturnType<typeof aggregate>['levelBreakdown'];
  expiresAt: string;
}

export async function resolvePublicShare(
  token: string,
): Promise<PublicSharePayload | null> {
  if (!token || token.length < 16) return null;

  // Indexed lookup is independent of the bcrypt verification step. This
  // avoids enumerating and comparing every active share link across tenants.
  const matched = await prisma.shareToken.findUnique({
    where: { lookupKey: createHash('sha256').update(token).digest('hex') },
    select: { id: true, orgId: true, tokenHash: true, expiresAt: true, revokedAt: true },
  });
  if (!matched || matched.revokedAt || matched.expiresAt <= new Date() ||
      !(await bcrypt.compare(token, matched.tokenHash))) return null;

  const { agg, org } = await withBypassRls(async (tx) => {
    await tx.shareToken.update({
      where: { id: matched.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });
    const { kpis, responses } = await loadScorecardInputs(tx, matched.orgId);
    const orgRow = await tx.organisation.findUnique({
      where: { id: matched.orgId },
      select: { orgName: true, industry: true },
    });
    return { agg: aggregate(kpis, responses), org: orgRow };
  });

  return {
    orgName: org?.orgName ?? 'Organisation',
    industry: org?.industry ?? null,
    peopleScore: agg.peopleScore,
    processScore: agg.processScore,
    companyScore: agg.companyScore,
    overallScore: agg.overallScore,
    completeness: agg.completeness,
    colorBand: agg.colorBand,
    levelBreakdown: agg.levelBreakdown,
    expiresAt: matched.expiresAt.toISOString(),
  };
}
