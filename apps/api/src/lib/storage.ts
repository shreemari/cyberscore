import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { env } from './env';

// Cloudflare R2 speaks S3. We keep it generic so swapping to S3 is
// just an env change.
let cached: S3Client | null = null;

function s3(): S3Client {
  if (cached) return cached;
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ENDPOINT) {
    throw new Error('R2 credentials not configured');
  }
  cached = new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
  return cached;
}

// MIME types we accept as evidence. Kept deliberately narrow.
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function isAllowedMime(type: string): boolean {
  return ALLOWED_MIME.has(type.toLowerCase());
}

// Evidence objects live under orgId so a misdirected presigned PUT can't
// write to another tenant's prefix. Key is never user-controlled.
export function buildEvidenceKey(orgId: string, kpiId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(0, 120);
  return `orgs/${orgId}/kpis/${kpiId}/${randomUUID()}-${safe}`;
}

export async function presignEvidenceUpload(args: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresSec?: number;
}): Promise<{ url: string; headers: Record<string, string>; expiresAt: Date }> {
  const expiresSec = args.expiresSec ?? 300;
  const cmd = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: args.key,
    ContentType: args.contentType,
    ContentLength: args.contentLength,
  });
  const url = await getSignedUrl(s3(), cmd, { expiresIn: expiresSec });
  return {
    url,
    headers: {
      'Content-Type': args.contentType,
      // Mobile should include this length so the presigned signature matches.
      'Content-Length': String(args.contentLength),
    },
    expiresAt: new Date(Date.now() + expiresSec * 1000),
  };
}

// Mobile view-link for a private evidence object. Expires in 10 min —
// long enough for a user to open the PDF viewer, short enough that the
// link is useless if leaked into a screen recording.
export async function presignEvidenceDownload(args: {
  key: string;
  expiresSec?: number;
}): Promise<{ url: string; expiresAt: Date }> {
  const expiresSec = args.expiresSec ?? 600;
  const cmd = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: args.key });
  const url = await getSignedUrl(s3(), cmd, { expiresIn: expiresSec });
  return { url, expiresAt: new Date(Date.now() + expiresSec * 1000) };
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
  );
}

export function publicUrlFor(key: string): string {
  if (env.R2_PUBLIC_URL) return `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  return `${env.R2_ENDPOINT?.replace(/\/$/, '')}/${env.R2_BUCKET}/${key}`;
}
