import { Worker, type Job } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { sendEmail, otpEmailTemplate, inviteEmailTemplate } from '@/lib/email';
import { QueueNames, type EmailJob } from '@/lib/queue';

// Drains the `email` queue. OTP emails today; PDF-delivery emails soon.
export function startEmailWorker(): Worker<EmailJob> {
  const worker = new Worker<EmailJob>(
    QueueNames.EMAIL,
    async (job: Job<EmailJob>) => {
      const { data } = job;
      if (data.type === 'OTP') {
        const tmpl = otpEmailTemplate({ orgName: data.orgName, code: data.code });
        await sendEmail({ to: data.email, ...tmpl });
        return { sent: true };
      }
      if (data.type === 'SCORECARD_PDF') {
        await sendEmail({
          to: data.email,
          subject: 'Your CyMetric report is ready',
          text: `Hi ${data.orgName},\n\nYour scorecard PDF: ${data.pdfUrl}\n\n— CyMetric`,
          html: `<p>Hi ${data.orgName},</p><p>Your scorecard PDF: <a href="${data.pdfUrl}">${data.pdfUrl}</a></p>`,
        });
        return { sent: true };
      }
      if (data.type === 'INVITE') {
        const tmpl = inviteEmailTemplate({
          orgName: data.orgName,
          invitedByName: data.invitedByName,
          inviteUrl: data.inviteUrl,
          expiresAt: data.expiresAt,
        });
        await sendEmail({ to: data.email, ...tmpl });
        return { sent: true };
      }
      // Exhaustiveness check — if a new job type is added to the union,
      // TypeScript will flag this line.
      const _exhaustive: never = data;
      throw new Error(`Unhandled email job type: ${JSON.stringify(_exhaustive)}`);
    },
    {
      connection: createRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) =>
    logger.error(
      { jobId: job?.id, attempts: job?.attemptsMade, err },
      'email job failed',
    ),
  );
  worker.on('ready', () => logger.info('email worker ready'));
  return worker;
}
