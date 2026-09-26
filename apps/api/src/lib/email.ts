import nodemailer, { type Transporter } from 'nodemailer';
import { env, isProd } from './env';
import { logger } from './logger';

let cached: Transporter | null = null;

function transport(): Transporter {
  if (cached) return cached;

  // In dev without SMTP config, use nodemailer's JSON transport
  // so OTP mail goes to the log instead of actually sending.
  if (!env.SMTP_HOST) {
    if (isProd) throw new Error('SMTP_HOST must be set in production');
    cached = nodemailer.createTransport({ jsonTransport: true });
    return cached;
  }

  cached = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });

  return cached;
}

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Outbound SMTP from Vercel serverless is flaky — Vercel sometimes
// blocks/throttles raw TCP on 25/465/587, which leaves nodemailer hung
// for 30+ seconds before timing out (Vercel kills the function before
// then and the caller sees a 500). To keep deployment options open we
// auto-detect the provider from SMTP_PASS and route through its HTTPS
// REST API instead — a plain fetch() which Vercel handles reliably
// in ~200ms.
//
// Supported providers (auto-detected by SMTP_PASS prefix):
//   xkeysib-* → Brevo (300 emails/day free, no domain required —
//                       what we use in production)
//   re_*      → Resend (kept for fallback / portability)
//
// Anything else → falls through to nodemailer SMTP (Postfix, Gmail,
// self-hosted etc.) for non-Vercel deployments.

function isBrevoApiKey(pass: string | undefined): pass is string {
  return !!pass && pass.startsWith('xkeysib-');
}

function isResendApiKey(pass: string | undefined): pass is string {
  return !!pass && pass.startsWith('re_');
}

// Brevo wants the sender as a structured {name, email} object, not a
// raw RFC-822 "Name <addr>" string. Parse our SMTP_FROM accordingly.
function parseSenderHeader(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.+?)\s*<\s*([^>]+)\s*>\s*$/);
  // The two capture groups are non-optional in this regex so they cannot
  // actually be undefined at runtime, but strict TypeScript with
  // noUncheckedIndexedAccess requires us to assert that explicitly.
  if (match && match[1] && match[2]) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: from.trim() };
}

async function sendViaBrevoHttp(args: SendArgs): Promise<void> {
  const sender = parseSenderHeader(env.SMTP_FROM);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.SMTP_PASS as string,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: args.to }],
      subject: args.subject,
      htmlContent: args.html,
      textContent: args.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>');
    logger.error(
      { status: res.status, body, to: args.to, subject: args.subject },
      'Brevo HTTP API rejected email',
    );
    throw new Error(`Brevo HTTP API ${res.status}: ${body}`);
  }
}

async function sendViaResendHttp(args: SendArgs): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SMTP_PASS}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.SMTP_FROM,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>');
    logger.error(
      { status: res.status, body, to: args.to, subject: args.subject },
      'Resend HTTP API rejected email',
    );
    throw new Error(`Resend HTTP API ${res.status}: ${body}`);
  }
}

export async function sendEmail(args: SendArgs): Promise<void> {
  // Route to the right provider based on the API key shape.
  if (isBrevoApiKey(env.SMTP_PASS)) {
    return sendViaBrevoHttp(args);
  }
  if (isResendApiKey(env.SMTP_PASS)) {
    return sendViaResendHttp(args);
  }

  // Fall back to nodemailer SMTP for self-hosted / Gmail / etc.
  const info = await transport().sendMail({
    from: env.SMTP_FROM,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });

  if (!isProd && (info as { message?: string }).message) {
    logger.info(
      { to: args.to, subject: args.subject },
      'Email dispatched (dev JSON transport — check the message field)',
    );
  }
}

// ------------------------------------------------------------
// Templates
// ------------------------------------------------------------
export function otpEmailTemplate(args: { orgName: string; code: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = 'Your CyMetric verification code';
  const text = `Hi ${args.orgName},

Your verification code is: ${args.code}

This code expires in 10 minutes. If you didn't request it, ignore this email.

— CyMetric`;

  const html = `<!doctype html>
<html><body style="font-family: system-ui, sans-serif; padding: 24px;">
  <h2>Verify your email</h2>
  <p>Hi <strong>${escapeHtml(args.orgName)}</strong>,</p>
  <p>Your CyMetric verification code is:</p>
  <p style="font-size: 32px; font-weight: 700; letter-spacing: 4px;">${args.code}</p>
  <p style="color: #666;">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
</body></html>`;

  return { subject, html, text };
}

// Invite email — sent when an admin adds an employee to their company.
// inviteUrl is the deep link the employee follows to set their password.
export function inviteEmailTemplate(args: {
  orgName: string;
  invitedByName: string | null;
  inviteUrl: string;
  expiresAt: string; // ISO
}): { subject: string; html: string; text: string } {
  const subject = `You've been invited to join ${args.orgName} on CyMetric`;
  const inviter = args.invitedByName ? `${args.invitedByName} (${args.orgName})` : args.orgName;
  const expiresHuman = new Date(args.expiresAt).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const text = `${inviter} invited you to join their CyMetric workspace.

Open this link to accept the invite and set your password:
${args.inviteUrl}

This link expires on ${expiresHuman}. If you weren't expecting this, ignore the email.

— CyMetric`;

  const html = `<!doctype html>
<html><body style="font-family: system-ui, sans-serif; padding: 24px; max-width: 560px;">
  <h2>You've been invited to CyMetric</h2>
  <p><strong>${escapeHtml(inviter)}</strong> invited you to join their workspace.</p>
  <p>
    <a href="${escapeHtml(args.inviteUrl)}"
       style="display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;
              border-radius:8px;text-decoration:none;font-weight:700;">
      Accept invite
    </a>
  </p>
  <p style="color:#666;font-size:13px;">Or paste this link: ${escapeHtml(args.inviteUrl)}</p>
  <p style="color:#666;font-size:13px;">Expires ${expiresHuman}. Ignore this email if you weren't expecting it.</p>
</body></html>`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
