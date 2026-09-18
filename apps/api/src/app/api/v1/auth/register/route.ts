import { NextResponse } from 'next/server';
import {
  RegisterRequest,
  RegisterMode,
  ErrorCodes,
  Role,
  OrgMode,
  JoinMode,
  emailDomainOf,
  isFreeEmailDomain,
} from '@cymetric/types';
import { hashPassword } from '@/lib/auth';
import { checkPwnedPassword } from '@/lib/hibp';
import { generateOtp, hashOtp, OTP_CONFIG } from '@/lib/otp';
import { withBypassRls } from '@/lib/prisma';
import { problem, parseJson, internalError } from '@/lib/problem';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { enqueueOtpEmail } from '@/lib/queue';
import { audit, AuditActions } from '@/lib/audit';
import { isDev } from '@/lib/env';

// POST /api/v1/auth/register
//
// Three modes:
//   SOLO                 — single-user org, OTP gate, existing flow
//   ENTERPRISE_ADMIN     — creates a company org keyed by emailDomain, locks
//                          framework, sends OTP. Free email providers rejected.
//   ENTERPRISE_EMPLOYEE  — joins an existing ENTERPRISE org by matching the
//                          email's domain. Honours org.joinMode (DOMAIN_AUTO
//                          or BOTH only — INVITE_ONLY orgs reject self-signup).
//                          No OTP — admin already vouched for the domain.
//
// Rate limit: 10 registrations / hour / IP.
export async function POST(req: Request) {
  const rl = await rateLimit({
    key: `register:ip:${clientIp(req)}`,
    max: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return problem(ErrorCodes.AUTH_RATE_LIMITED, {
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    });
  }

  const parsed = await parseJson(req, RegisterRequest);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const email = body.email.trim().toLowerCase();
  const domain = emailDomainOf(email);

  // HIBP check — block breached passwords at registration. Same for every mode.
  const pwned = await checkPwnedPassword(body.password);
  if (pwned.pwned) return problem(ErrorCodes.AUTH_PASSWORD_PWNED);

  const passwordHash = await hashPassword(body.password);

  try {
    if (body.mode === RegisterMode.ENTERPRISE_EMPLOYEE) {
      return await registerEnterpriseEmployee({
        req,
        email,
        domain,
        name: body.name,
        passwordHash,
      });
    }

    if (body.mode === RegisterMode.ENTERPRISE_ADMIN) {
      return await registerEnterpriseAdmin({
        req,
        email,
        domain,
        name: body.name,
        passwordHash,
        orgName: body.orgName!, // required by superRefine
        industry: body.industry!,
        selectedFramework: body.selectedFramework ?? 'EXCEL',
        joinMode: body.joinMode ?? JoinMode.BOTH,
      });
    }

    // SOLO (default).
    return await registerSolo({
      req,
      email,
      name: body.name,
      passwordHash,
      orgName: body.orgName!,
      industry: body.industry!,
      selectedFramework: body.selectedFramework ?? 'EXCEL',
    });
  } catch (err) {
    return internalError(err, { route: 'auth/register', mode: body.mode });
  }
}

// ─── SOLO ──────────────────────────────────────────────────────────────────
async function registerSolo(args: {
  req: Request;
  email: string;
  name: string;
  passwordHash: string;
  orgName: string;
  industry: string;
  selectedFramework: 'EXCEL' | 'NIST_CSF' | 'ISO27001';
}) {
  const code = generateOtp();
  const otpHash = await hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_CONFIG.EXPIRY_MIN * 60 * 1000);

  const org = await withBypassRls(async (tx) => {
    const existing = await tx.organisation.findUnique({
      where: { email: args.email },
      select: { id: true },
    });
    if (existing) return null;

    const created = await tx.organisation.create({
      data: {
        orgName: args.orgName,
        industry: args.industry,
        email: args.email,
        passwordHash: args.passwordHash,
        selectedFramework: args.selectedFramework,
        mode: OrgMode.SOLO,
        // SOLO orgs don't surface joinMode/emailDomain — defaults are inert.
        users: {
          create: {
            name: args.name,
            email: args.email,
            passwordHash: args.passwordHash,
            role: Role.ADMIN,
          },
        },
      },
      select: { id: true },
    });

    await tx.otpVerification.updateMany({
      where: { email: args.email, used: false },
      data: { used: true },
    });
    await tx.otpVerification.create({
      data: { email: args.email, otpHash, purpose: 'REGISTER', expiresAt },
    });

    return created;
  });

  if (!org) return problem(ErrorCodes.AUTH_EMAIL_TAKEN);

  await enqueueOtpEmail({ email: args.email, orgName: args.orgName, code });
  await audit({
    action: AuditActions.REGISTER,
    resource: `organisation:${org.id}`,
    orgId: org.id,
    req: args.req,
    after: { email: args.email, mode: OrgMode.SOLO },
  });

  return NextResponse.json({
    orgId: org.id,
    email: args.email,
    otpSent: true,
    mode: OrgMode.SOLO,
    role: Role.ADMIN,
    ...(isDev ? { devOtp: code } : {}),
  });
}

// ─── ENTERPRISE_ADMIN ─────────────────────────────────────────────────────
async function registerEnterpriseAdmin(args: {
  req: Request;
  email: string;
  domain: string;
  name: string;
  passwordHash: string;
  orgName: string;
  industry: string;
  selectedFramework: 'EXCEL' | 'NIST_CSF' | 'ISO27001';
  joinMode: JoinMode;
}) {
  if (!args.domain) {
    return problem(ErrorCodes.VALIDATION_FAILED, { detail: 'Email is missing a domain' });
  }
  if (isFreeEmailDomain(args.domain)) {
    return problem(ErrorCodes.ENTERPRISE_DOMAIN_FREE);
  }

  const code = generateOtp();
  const otpHash = await hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_CONFIG.EXPIRY_MIN * 60 * 1000);

  const result = await withBypassRls(async (tx) => {
    if (await tx.organisation.findUnique({ where: { email: args.email }, select: { id: true } })) {
      return { kind: 'email_taken' as const };
    }
    if (
      await tx.organisation.findUnique({
        where: { emailDomain: args.domain },
        select: { id: true },
      })
    ) {
      return { kind: 'domain_taken' as const };
    }

    const created = await tx.organisation.create({
      data: {
        orgName: args.orgName,
        industry: args.industry,
        email: args.email,
        passwordHash: args.passwordHash,
        selectedFramework: args.selectedFramework,
        mode: OrgMode.ENTERPRISE,
        emailDomain: args.domain,
        joinMode: args.joinMode,
        // Once ENTERPRISE picks a framework, it sticks for all employees.
        // Admin can flip it later via /me/profile, which clears responses.
        frameworkLocked: true,
        users: {
          create: {
            name: args.name,
            email: args.email,
            passwordHash: args.passwordHash,
            role: Role.ADMIN,
          },
        },
      },
      select: { id: true },
    });

    await tx.otpVerification.updateMany({
      where: { email: args.email, used: false },
      data: { used: true },
    });
    await tx.otpVerification.create({
      data: { email: args.email, otpHash, purpose: 'REGISTER', expiresAt },
    });

    return { kind: 'ok' as const, org: created };
  });

  if (result.kind === 'email_taken') return problem(ErrorCodes.AUTH_EMAIL_TAKEN);
  if (result.kind === 'domain_taken') return problem(ErrorCodes.ENTERPRISE_DOMAIN_TAKEN);

  await enqueueOtpEmail({ email: args.email, orgName: args.orgName, code });
  await audit({
    action: AuditActions.REGISTER,
    resource: `organisation:${result.org.id}`,
    orgId: result.org.id,
    req: args.req,
    after: {
      email: args.email,
      mode: OrgMode.ENTERPRISE,
      emailDomain: args.domain,
      joinMode: args.joinMode,
    },
  });

  return NextResponse.json({
    orgId: result.org.id,
    email: args.email,
    otpSent: true,
    mode: OrgMode.ENTERPRISE,
    role: Role.ADMIN,
    ...(isDev ? { devOtp: code } : {}),
  });
}

// ─── ENTERPRISE_EMPLOYEE ──────────────────────────────────────────────────
// Self-service join via matching company email domain. Skips OTP —
// the admin already verified the domain when they created the org.
async function registerEnterpriseEmployee(args: {
  req: Request;
  email: string;
  domain: string;
  name: string;
  passwordHash: string;
}) {
  if (!args.domain) {
    return problem(ErrorCodes.VALIDATION_FAILED, { detail: 'Email is missing a domain' });
  }
  if (isFreeEmailDomain(args.domain)) {
    // Wrong tier — push them back to SOLO instead of silently creating one.
    return problem(ErrorCodes.ENTERPRISE_DOMAIN_FREE);
  }

  const result = await withBypassRls(async (tx) => {
    const org = await tx.organisation.findUnique({
      where: { emailDomain: args.domain },
      select: {
        id: true,
        orgName: true,
        mode: true,
        joinMode: true,
        deletedAt: true,
      },
    });
    if (!org || org.deletedAt || org.mode !== OrgMode.ENTERPRISE) {
      return { kind: 'no_org' as const };
    }
    if (org.joinMode === JoinMode.INVITE_ONLY) {
      return { kind: 'invite_only' as const };
    }

    if (await tx.user.findUnique({ where: { email: args.email }, select: { id: true } })) {
      return { kind: 'email_taken' as const };
    }

    const user = await tx.user.create({
      data: {
        orgId: org.id,
        name: args.name,
        email: args.email,
        passwordHash: args.passwordHash,
        role: Role.EMPLOYEE,
      },
      select: { id: true },
    });

    return { kind: 'ok' as const, orgId: org.id, orgName: org.orgName, userId: user.id };
  });

  if (result.kind === 'no_org') return problem(ErrorCodes.ENTERPRISE_DOMAIN_NOT_FOUND);
  if (result.kind === 'invite_only') return problem(ErrorCodes.ENTERPRISE_JOIN_DISABLED);
  if (result.kind === 'email_taken') return problem(ErrorCodes.AUTH_EMAIL_TAKEN);

  await audit({
    action: AuditActions.REGISTER,
    resource: `user:${result.userId}`,
    orgId: result.orgId,
    req: args.req,
    after: { email: args.email, mode: OrgMode.ENTERPRISE, role: Role.EMPLOYEE, joinedVia: 'DOMAIN' },
  });

  return NextResponse.json({
    orgId: result.orgId,
    email: args.email,
    otpSent: false,
    mode: OrgMode.ENTERPRISE,
    role: Role.EMPLOYEE,
  });
}
