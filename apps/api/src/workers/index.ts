import { logger } from '@/lib/logger';
import { startEmailWorker } from './email.worker';
import { startSnapshotWorker } from './snapshot.worker';
import { startPushWorker } from './push.worker';
import { startAbandonmentWorker } from './abandonment.worker';
import { startScheduler } from './scheduler';

// Worker bootstrap — run as a separate Node process:
//   npm run worker
// Do NOT start workers inside the API process; they need their own
// Redis connections and shouldn't share event loops with request handlers.

async function main() {
  logger.info('Starting workers…');

  const workers = [
    startEmailWorker(),
    startSnapshotWorker(),
    startPushWorker(),
    startAbandonmentWorker(),
  ];
  const scheduler = startScheduler();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down workers');
    scheduler.stop();
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Worker bootstrap failed');
  process.exit(1);
});
