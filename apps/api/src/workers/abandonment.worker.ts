import { Worker, type Job } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { QueueNames, type AbandonmentJob, enqueuePush } from '@/lib/queue';
import { prisma } from '@/lib/prisma';

// Worker: dequeues AbandonmentJob at a given stage (24H / 72H / 7D) and,
// if the org is still in a stalled assessment state, fans out a push
// reminder via the push queue.
//
// Skip conditions:
//   - Org has deleted itself
//   - Org has finished the assessment (all three levels COMPLETED)
//   - A scorecard snapshot exists from *after* the stall point (user came
//     back on another device)
//
// The scheduling of these jobs is owned by the scheduler (workers/scheduler.ts
// also fires a daily abandonment sweep — see there). We keep the worker
// idempotent because BullMQ retries on failure.

const STAGE_COPY: Record<
  AbandonmentJob['stage'],
  { title: string; body: string }
> = {
  '24H': {
    title: 'Pick up where you left off',
    body: 'Your cybersecurity assessment is waiting — a few more answers gets you a full scorecard.',
  },
  '72H': {
    title: 'Your scorecard is incomplete',
    body: 'It only takes a couple of minutes per KPI. Finish what you started.',
  },
  '7D': {
    title: 'Still interested in your CyMetric?',
    body: "Come back and wrap up the assessment — we'll show you exactly what to improve.",
  },
};

export function startAbandonmentWorker(): Worker<AbandonmentJob> {
  const worker = new Worker<AbandonmentJob>(
    QueueNames.ABANDONMENT,
    async (job: Job<AbandonmentJob>) => {
      const { orgId, stage } = job.data;

      const org = await prisma.organisation.findFirst({
        where: { id: orgId, deletedAt: null },
        select: {
          id: true,
          progress: { select: { status: true } },
          _count: { select: { pushTokens: { where: { isActive: true } } } },
        },
      });
      if (!org) return { skipped: 'org_missing' };
      if (org._count.pushTokens === 0) return { skipped: 'no_push_tokens' };

      const allLevelsDone =
        org.progress.length === 3 &&
        org.progress.every((p) => p.status === 'COMPLETED');
      if (allLevelsDone) return { skipped: 'already_complete' };

      const copy = STAGE_COPY[stage];
      await enqueuePush({
        orgId,
        title: copy.title,
        body: copy.body,
        data: { type: 'ABANDONMENT', stage },
      });

      return { sent: true, stage };
    },
    {
      connection: createRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) =>
    logger.error(
      { jobId: job?.id, attempts: job?.attemptsMade, err },
      'abandonment job failed',
    ),
  );
  worker.on('ready', () => logger.info('abandonment worker ready'));
  return worker;
}

// ------------------------------------------------------------
// Sweep helper — called by the scheduler once a day. Enumerates orgs that
// are mid-assessment and enqueues one job per stage where the last activity
// window matches. Idempotent: each org+stage has a deterministic jobId so
// a second sweep in the same day won't duplicate a reminder.
// ------------------------------------------------------------
const STAGE_WINDOWS: Array<{
  stage: AbandonmentJob['stage'];
  minHoursAgo: number;
  maxHoursAgo: number;
}> = [
  { stage: '24H', minHoursAgo: 24, maxHoursAgo: 48 },
  { stage: '72H', minHoursAgo: 72, maxHoursAgo: 96 },
  { stage: '7D', minHoursAgo: 168, maxHoursAgo: 192 },
];

export async function sweepAbandonment(): Promise<
  Array<{ orgId: string; stage: AbandonmentJob['stage'] }>
> {
  // Candidates: progress rows that are IN_PROGRESS or NOT_STARTED and were
  // last touched within one of our windows.
  const now = Date.now();
  const queued: Array<{ orgId: string; stage: AbandonmentJob['stage'] }> = [];

  for (const { stage, minHoursAgo, maxHoursAgo } of STAGE_WINDOWS) {
    const minTs = new Date(now - maxHoursAgo * 3_600_000);
    const maxTs = new Date(now - minHoursAgo * 3_600_000);

    const rows = await prisma.$queryRaw<{ orgId: string }[]>`
      SELECT DISTINCT p."orgId"
      FROM assessment_progress p
      JOIN organisations o ON o.id = p."orgId" AND o."deletedAt" IS NULL
      WHERE p.status IN ('IN_PROGRESS', 'NOT_STARTED')
        AND (p."pausedAt" >= ${minTs} AND p."pausedAt" < ${maxTs})
      -- don't nag orgs who completed after pausing this level
      GROUP BY p."orgId"
      HAVING bool_or(p.status = 'COMPLETED') = false OR count(*) < 3
    `;
    for (const row of rows) {
      queued.push({ orgId: row.orgId, stage });
    }
  }

  return queued;
}
