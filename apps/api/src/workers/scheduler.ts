import { logger } from '@/lib/logger';
import { enqueueSnapshot, enqueueAbandonment } from '@/lib/queue';
import { listOrgsNeedingSnapshot } from './snapshot.worker';
import { sweepAbandonment } from './abandonment.worker';

// In-process scheduler for periodic work. Kept here (not a separate cron
// service) to keep the deployment footprint small — the worker process is
// the one thing that's always up and doesn't serve request traffic.
//
// Two independent cadences:
//   - Snapshots: every 6h for any org whose latest snapshot is >24h old.
//   - Abandonment: every 6h, sweeps 24h/72h/7d stall windows and enqueues
//     push reminder jobs. Per-org-per-stage jobIds keep double-sends out.

const HOUR_MS = 60 * 60 * 1000;
const SNAPSHOT_INTERVAL_MS = 6 * HOUR_MS;
const SNAPSHOT_AGE_THRESHOLD_MS = 24 * HOUR_MS;
const ABANDONMENT_INTERVAL_MS = 6 * HOUR_MS;

export function startScheduler(): { stop: () => void } {
  let snapshotRunning = false;
  let abandonmentRunning = false;

  const snapshotTick = async () => {
    if (snapshotRunning) return;
    snapshotRunning = true;
    try {
      const orgIds = await listOrgsNeedingSnapshot(SNAPSHOT_AGE_THRESHOLD_MS);
      for (const orgId of orgIds) {
        await enqueueSnapshot({ orgId, reason: 'SCHEDULED' });
      }
      if (orgIds.length > 0) {
        logger.info({ count: orgIds.length }, 'scheduler enqueued snapshots');
      }
    } catch (err) {
      logger.error({ err }, 'scheduler snapshot tick failed');
    } finally {
      snapshotRunning = false;
    }
  };

  const abandonmentTick = async () => {
    if (abandonmentRunning) return;
    abandonmentRunning = true;
    try {
      const candidates = await sweepAbandonment();
      for (const c of candidates) {
        await enqueueAbandonment(c);
      }
      if (candidates.length > 0) {
        logger.info(
          { count: candidates.length },
          'scheduler enqueued abandonment reminders',
        );
      }
    } catch (err) {
      logger.error({ err }, 'scheduler abandonment tick failed');
    } finally {
      abandonmentRunning = false;
    }
  };

  // Kick both at startup so a fresh deploy doesn't wait a whole interval.
  void snapshotTick();
  void abandonmentTick();

  const snapshotHandle = setInterval(() => void snapshotTick(), SNAPSHOT_INTERVAL_MS);
  const abandonmentHandle = setInterval(
    () => void abandonmentTick(),
    ABANDONMENT_INTERVAL_MS,
  );

  return {
    stop: () => {
      clearInterval(snapshotHandle);
      clearInterval(abandonmentHandle);
    },
  };
}
