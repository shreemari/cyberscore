import { Worker, type Job } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { QueueNames, type PushJob } from '@/lib/queue';
import { sendToOrg } from '@/lib/push';
import { prisma } from '@/lib/prisma';

// Worker: fans out a push-notification payload to every active Expo token
// on the target org and mirrors the payload into the Notification table
// so the mobile bell icon still shows it even if the OS-level push got
// suppressed (silent mode, background app, etc.).
export function startPushWorker(): Worker<PushJob> {
  const worker = new Worker<PushJob>(
    QueueNames.PUSH,
    async (job: Job<PushJob>) => {
      const { orgId, title, body, data } = job.data;

      await prisma.notification.create({
        data: {
          orgId,
          type: (data?.type as string) ?? 'GENERIC',
          title,
          body,
          data: data as object,
        },
      });

      const delivered = await sendToOrg(orgId, {
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
      });

      return { delivered };
    },
    {
      connection: createRedisConnection(),
      concurrency: 10,
    },
  );

  worker.on('failed', (job, err) =>
    logger.error(
      { jobId: job?.id, attempts: job?.attemptsMade, err },
      'push job failed',
    ),
  );
  worker.on('ready', () => logger.info('push worker ready'));
  return worker;
}
