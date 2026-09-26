import { Worker, type Job } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { QueueNames, type SnapshotJob } from '@/lib/queue';
import { prisma, withBypassRls } from '@/lib/prisma';
import { aggregate, loadScorecardInputs } from '@/lib/scorecard';

// Worker: writes a ScorecardSnapshot row for one org.
//
// Trigger sources:
//   - SCHEDULED: a cron (see workers/scheduler.ts) fans one job per active org
//   - KPI_SUBMITTED: enqueued from /kpis/submit when the user has enough
//     answers that a fresh snapshot is meaningful (we debounce via the
//     per-org jobId so a burst of submissions only writes once)
//   - MANUAL: admin-triggered rebuild for verification
//
// Snapshots store the aggregate + the underperforming-KPI breakdown so the
// mobile trend chart and the share/public view never need to recompute.
export function startSnapshotWorker(): Worker<SnapshotJob> {
  const worker = new Worker<SnapshotJob>(
    QueueNames.SNAPSHOT,
    async (job: Job<SnapshotJob>) => {
      const { orgId, reason } = job.data;

      // Bypass RLS because this runs as a system job, not a user request —
      // there's no auth context to scope withTenant against.
      const result = await withBypassRls(async (tx) => {
        const { kpis, responses } = await loadScorecardInputs(tx, orgId);
        if (responses.length === 0) return { written: false as const };

        const agg = aggregate(kpis, responses);
        const snapshot = await tx.scorecardSnapshot.create({
          data: {
            orgId,
            peopleScore: agg.peopleScore,
            processScore: agg.processScore,
            companyScore: agg.companyScore,
            overallScore: agg.overallScore,
            completeness: agg.completeness,
            breakdown: {
              levelBreakdown: agg.levelBreakdown,
              underperforming: agg.underperforming,
              reason,
            } as object,
          },
        });
        return { written: true as const, snapshotId: snapshot.id };
      });

      if (!result.written) {
        logger.info({ orgId, reason }, 'snapshot skipped — no responses yet');
        return { skipped: true };
      }

      logger.info({ orgId, reason, snapshotId: result.snapshotId }, 'snapshot written');
      return { snapshotId: result.snapshotId };
    },
    {
      connection: createRedisConnection(),
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) =>
    logger.error(
      { jobId: job?.id, attempts: job?.attemptsMade, err },
      'snapshot job failed',
    ),
  );
  worker.on('ready', () => logger.info('snapshot worker ready'));
  return worker;
}

// Used by the scheduler — enumerate orgs that have at least one response
// but whose newest snapshot is older than `minAgeMs` (or missing entirely).
export async function listOrgsNeedingSnapshot(minAgeMs: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - minAgeMs);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT o.id
    FROM organisations o
    WHERE EXISTS (SELECT 1 FROM responses r WHERE r."orgId" = o.id)
      AND (
        NOT EXISTS (SELECT 1 FROM scorecard_snapshots s WHERE s."orgId" = o.id)
        OR (
          SELECT MAX(s."generatedAt") FROM scorecard_snapshots s WHERE s."orgId" = o.id
        ) < ${cutoff}
      )
      AND o."deletedAt" IS NULL
  `;
  return rows.map((r) => r.id);
}
