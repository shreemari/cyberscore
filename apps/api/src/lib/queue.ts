import { Queue, QueueEvents, type JobsOptions } from 'bullmq';
import { createRedisConnection } from './redis';
import { logger } from './logger';

// Job queues — one per concern so backpressure on PDFs doesn't stall OTPs.
// Workers live in src/workers/ and run as separate Node processes.
//
// Retry policy: exponential backoff, capped attempts, fail into dead
// letter via Bull's built-in failedReason tracking.

export const QueueNames = {
  EMAIL: 'email',
  PDF: 'pdf',
  AI: 'ai',
  PUSH: 'push',
  SNAPSHOT: 'snapshot',
  ABANDONMENT: 'abandonment',
} as const;
export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];

const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 3600, count: 1000 }, // keep 1h / 1000 for observability
  removeOnFail: { age: 7 * 86_400 }, // keep failed jobs 7 days for DLQ inspection
};

// ------------------------------------------------------------
// Job payload types
// ------------------------------------------------------------
export interface EmailOtpJob {
  type: 'OTP';
  email: string;
  orgName: string;
  code: string;
}
export interface EmailPdfJob {
  type: 'SCORECARD_PDF';
  email: string;
  orgName: string;
  pdfUrl: string;
}
export interface EmailInviteJob {
  type: 'INVITE';
  email: string;
  orgName: string;
  invitedByName: string | null;
  inviteUrl: string;
  expiresAt: string; // ISO
}
export type EmailJob = EmailOtpJob | EmailPdfJob | EmailInviteJob;

export interface PdfJob {
  snapshotId: string;
  orgId: string;
}

export interface AiCompareJob {
  orgId: string;
  userId: string;
  traceId: string;
}

export interface PushJob {
  orgId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface SnapshotJob {
  orgId: string;
  reason: 'KPI_SUBMITTED' | 'SCHEDULED' | 'MANUAL';
}

export interface AbandonmentJob {
  orgId: string;
  stage: '24H' | '72H' | '7D';
}

// ------------------------------------------------------------
// Queue singletons — used by API route handlers to enqueue work.
// Workers in src/workers/ consume from these.
// ------------------------------------------------------------
const globalForQueues = globalThis as unknown as {
  _queues?: Record<QueueName, Queue>;
};

function buildQueue<T>(name: QueueName): Queue<T> {
  const connection = createRedisConnection();
  const q = new Queue<T>(name, { connection, defaultJobOptions: DEFAULT_JOB_OPTS });
  const events = new QueueEvents(name, { connection: createRedisConnection() });
  events.on('failed', ({ jobId, failedReason }) => {
    logger.warn({ queue: name, jobId, failedReason }, 'BullMQ job failed');
  });
  return q;
}

function getQueues(): Record<QueueName, Queue> {
  if (!globalForQueues._queues) {
    globalForQueues._queues = {
      [QueueNames.EMAIL]: buildQueue<EmailJob>(QueueNames.EMAIL),
      [QueueNames.PDF]: buildQueue<PdfJob>(QueueNames.PDF),
      [QueueNames.AI]: buildQueue<AiCompareJob>(QueueNames.AI),
      [QueueNames.PUSH]: buildQueue<PushJob>(QueueNames.PUSH),
      [QueueNames.SNAPSHOT]: buildQueue<SnapshotJob>(QueueNames.SNAPSHOT),
      [QueueNames.ABANDONMENT]: buildQueue<AbandonmentJob>(QueueNames.ABANDONMENT),
    };
  }
  return globalForQueues._queues;
}

export const queues = {
  email: () => getQueues()[QueueNames.EMAIL] as Queue<EmailJob>,
  pdf: () => getQueues()[QueueNames.PDF] as Queue<PdfJob>,
  ai: () => getQueues()[QueueNames.AI] as Queue<AiCompareJob>,
  push: () => getQueues()[QueueNames.PUSH] as Queue<PushJob>,
  snapshot: () => getQueues()[QueueNames.SNAPSHOT] as Queue<SnapshotJob>,
  abandonment: () => getQueues()[QueueNames.ABANDONMENT] as Queue<AbandonmentJob>,
};

// ------------------------------------------------------------
// Convenience enqueuers — type-safe wrappers used by route handlers
// ------------------------------------------------------------
// NOTE: On serverless (Vercel) there is no background worker draining the
// email queue, so we send emails inline via Resend SMTP. The function names
// keep `enqueue*` for source compatibility with every existing call site —
// they just no longer go through Redis. Resend's SMTP is fast enough (~200ms)
// that we can afford to await within the API request.
export async function enqueueOtpEmail(payload: Omit<EmailOtpJob, 'type'>): Promise<void> {
  const { sendEmail, otpEmailTemplate } = await import('./email');
  const { subject, html, text } = otpEmailTemplate({
    orgName: payload.orgName,
    code: payload.code,
  });
  try {
    await sendEmail({ to: payload.email, subject, html, text });
  } catch (err) {
    logger.error({ err, to: payload.email }, 'Inline OTP email send failed');
    throw err;
  }
}

export async function enqueueInviteEmail(payload: Omit<EmailInviteJob, 'type'>): Promise<void> {
  const { sendEmail, inviteEmailTemplate } = await import('./email');
  const { subject, html, text } = inviteEmailTemplate({
    orgName: payload.orgName,
    invitedByName: payload.invitedByName,
    inviteUrl: payload.inviteUrl,
    expiresAt: payload.expiresAt,
  });
  try {
    await sendEmail({ to: payload.email, subject, html, text });
  } catch (err) {
    logger.error({ err, to: payload.email }, 'Inline invite email send failed');
    throw err;
  }
}

// Snapshot write moved inline for the same reason email was moved inline:
// on Vercel there is no background worker draining BullMQ, so a queued
// job sits in Redis forever and no row ever lands in scorecard_snapshots.
// The user's Analytics trend chart then has nothing to plot.
//
// We also intentionally drop the per-org dedup. The original design
// debounced multiple KPI submissions into one snapshot so a burst write
// did not flood the table. With inline writes we want the opposite:
// every submission produces a row so the trend chart has a real point
// for each meaningful change in the user's scorecard.
//
// The function name stays `enqueueSnapshot` so every caller works
// unchanged. The cost on the request thread is two parallel SELECTs
// (KPIs + responses) plus one INSERT, roughly 50 to 150 ms warm.
// Callers already invoke this with .catch() (fire-and-forget), so a
// transient failure does not surface to the user.
export async function enqueueSnapshot(payload: SnapshotJob): Promise<void> {
  const { withBypassRls } = await import('./prisma');
  const { aggregate, loadScorecardInputs } = await import('./scorecard');

  try {
    await withBypassRls(async (tx) => {
      const { kpis, responses } = await loadScorecardInputs(tx, payload.orgId);
      if (responses.length === 0) {
        // Nothing answered yet, do not write an empty snapshot.
        return;
      }
      const agg = aggregate(kpis, responses);
      await tx.scorecardSnapshot.create({
        data: {
          orgId: payload.orgId,
          peopleScore: agg.peopleScore,
          processScore: agg.processScore,
          companyScore: agg.companyScore,
          overallScore: agg.overallScore,
          completeness: agg.completeness,
        },
      });
    });
  } catch (err) {
    logger.error(
      { err, orgId: payload.orgId, reason: payload.reason },
      'Inline snapshot write failed',
    );
    throw err;
  }
}

export async function enqueuePush(payload: PushJob): Promise<void> {
  await queues.push().add('push', payload);
}

export async function enqueueAiCompare(payload: AiCompareJob): Promise<void> {
  await queues.ai().add('compare', payload);
}

// Deterministic jobId per (org, stage) — prevents double-nagging when the
// daily sweep runs more than once. BullMQ rejects ':' in custom jobIds.
export async function enqueueAbandonment(payload: AbandonmentJob): Promise<void> {
  await queues.abandonment().add('abandonment', payload, {
    jobId: `abandonment_${payload.orgId}_${payload.stage}`,
    removeOnComplete: true,
  });
}
