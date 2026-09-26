import { NextResponse } from 'next/server';
import { SubmitKpiRequest, ErrorCodes } from '@cymetric/types';
import { prisma, withTenant } from '@/lib/prisma';
import { parseJson, problem, internalError } from '@/lib/problem';
import { requireAuth } from '@/lib/require-auth';
import { scoreResponse } from '@/lib/scoring';
import { audit, AuditActions } from '@/lib/audit';
import { enqueueSnapshot } from '@/lib/queue';
import { logger } from '@/lib/logger';
import { canAssessLevel } from '@/lib/access';

// POST /api/v1/kpis/submit
//
// Submits an answer for a single KPI. Flow:
//   1. Load KPI + tiers (global — no RLS needed; KPIs are shared catalogue).
//   2. Match the input against tiers to compute actualScore + weightedScore.
//   3. Upsert a Response row keyed by (orgId, kpiId) inside withTenant so
//      RLS catches any orgId drift.
//   4. If the client sent an idempotencyKey, replay returns the existing row
//      unchanged — mobile can safely retry the call after a network blip.
export async function POST(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;

  const parsed = await parseJson(req, SubmitKpiRequest);
  if (!parsed.ok) return parsed.response;
  const { kpiId, inputValue, idempotencyKey } = parsed.data;

  try {
    const kpi = await prisma.kpi.findFirst({
      where: { id: kpiId, isActive: true, deletedAt: null },
      include: { tiers: true },
    });
    if (!kpi) return problem(ErrorCodes.KPI_NOT_FOUND);

    // Per-user level gate: employees can only submit for levels their admin
    // assigned them. Admins + SOLO bypass this via canAssessLevel().
    const caller = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { role: true, allowedLevels: true, org: { select: { mode: true } } },
    });
    if (!caller) return problem(ErrorCodes.AUTH_TOKEN_INVALID);
    if (
      !canAssessLevel(
        { role: caller.role, orgMode: caller.org.mode, allowedLevels: caller.allowedLevels },
        kpi.level,
      )
    ) {
      return problem(ErrorCodes.FORBIDDEN, {
        detail: `You don't have access to ${kpi.level} assessments. Ask your admin.`,
      });
    }

    const scored = scoreResponse({
      inputValue,
      tiers: kpi.tiers,
      maxScore: kpi.maxScore,
      weightage: kpi.weightage,
    });
    if (!scored) return problem(ErrorCodes.KPI_NO_MATCHING_TIER);

    const response = await withTenant(auth.orgId, async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.response.findFirst({
          where: { orgId: auth.orgId, idempotencyKey },
        });
        if (existing) return existing;
      }
      // Per-user uniqueness: each submitter has their own row. Same shape
      // works for SOLO (single user → single row) and ENTERPRISE (admin row
      // + employee rows aggregated at score time by loadScorecardInputs).
      return tx.response.upsert({
        where: {
          orgId_kpiId_submittedById: {
            orgId: auth.orgId,
            kpiId,
            submittedById: auth.userId,
          },
        },
        create: {
          orgId: auth.orgId,
          kpiId,
          kpiVersion: kpi.version,
          submittedById: auth.userId,
          inputValue,
          actualScore: scored.actualScore,
          weightedScore: scored.weightedScore,
          matchedTierId: scored.matchedTierId,
          idempotencyKey: idempotencyKey ?? null,
          isNa: false,
          naJustification: null,
        },
        update: {
          kpiVersion: kpi.version,
          inputValue,
          actualScore: scored.actualScore,
          weightedScore: scored.weightedScore,
          matchedTierId: scored.matchedTierId,
          idempotencyKey: idempotencyKey ?? null,
          isNa: false,
          naJustification: null,
        },
      });
    });

    void audit({
      action: AuditActions.KPI_SUBMITTED,
      resource: `kpi:${kpiId}`,
      actorId: auth.userId,
      orgId: auth.orgId,
      after: {
        responseId: response.id,
        actualScore: response.actualScore,
        weightedScore: response.weightedScore,
      },
      req,
    });

    // Debounced snapshot enqueue — the helper uses a deterministic jobId per
    // org so a burst of submits only writes one snapshot, and the trend chart
    // picks it up without waiting for the nightly scheduler.
    enqueueSnapshot({ orgId: auth.orgId, reason: 'KPI_SUBMITTED' }).catch((err) => {
      logger.warn({ err, orgId: auth.orgId }, 'snapshot enqueue failed');
    });

    return NextResponse.json({
      responseId: response.id,
      kpiId: response.kpiId,
      actualScore: response.actualScore,
      weightedScore: response.weightedScore,
      matchedTierId: response.matchedTierId,
      submittedAt: response.submittedAt.toISOString(),
    });
  } catch (err) {
    return internalError(err, { route: 'kpis:submit', kpiId });
  }
}
