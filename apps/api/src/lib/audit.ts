import { prisma, withTenant } from './prisma';
import { logger } from './logger';
import { clientIp } from './rate-limit';

// Audit log writer. Every security-relevant action flows through here.
// Tenant events are written inside withTenant() so audit RLS permits them.
// Anonymous / system audit events preserve the existing non-tenant path.
//
// We swallow write failures — an audit write failure must not break the
// original request path, but we log it loudly.

export const AuditActions = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  REGISTER: 'REGISTER',
  OTP_SENT: 'OTP_SENT',
  OTP_VERIFIED: 'OTP_VERIFIED',
  OTP_FAILED: 'OTP_FAILED',
  TOTP_ENROLLED: 'TOTP_ENROLLED',
  TOTP_DISABLED: 'TOTP_DISABLED',
  REFRESH_ROTATED: 'REFRESH_ROTATED',
  REFRESH_REVOKED: 'REFRESH_REVOKED',
  KPI_SUBMITTED: 'KPI_SUBMITTED',
  KPI_NA_MARKED: 'KPI_NA_MARKED',
  EVIDENCE_UPLOADED: 'EVIDENCE_UPLOADED',
  SCORE_CALCULATED: 'SCORE_CALCULATED',
  ACTION_UPDATED: 'ACTION_UPDATED',
  RISK_CREATED: 'RISK_CREATED',
  RISK_UPDATED: 'RISK_UPDATED',
  SHARE_CREATED: 'SHARE_CREATED',
  SHARE_REVOKED: 'SHARE_REVOKED',
  AI_COMPARE_CALLED: 'AI_COMPARE_CALLED',
  KPI_CREATED: 'KPI_CREATED',
  KPI_UPDATED: 'KPI_UPDATED',
  KPI_DELETED: 'KPI_DELETED',
  ADMIN_IMPERSONATED: 'ADMIN_IMPERSONATED',
  TEAM_INVITED: 'TEAM_INVITED',
  TEAM_REMOVED: 'TEAM_REMOVED',
  TEAM_LEVELS_CHANGED: 'TEAM_LEVELS_CHANGED',
} as const;
export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

export interface AuditArgs {
  action: AuditAction;
  resource: string;
  actorId?: string | null;
  orgId?: string | null;
  before?: unknown;
  after?: unknown;
  req?: Request;
  traceId?: string;
}

export async function audit(args: AuditArgs): Promise<void> {
  try {
    const record = {
      actorId: args.actorId ?? null,
      orgId: args.orgId ?? null,
      action: args.action,
      resource: args.resource.slice(0, 200),
      before: args.before as never,
      after: args.after as never,
      ipAddress: args.req ? clientIp(args.req) : null,
      userAgent: args.req?.headers.get('user-agent')?.slice(0, 512) ?? null,
      traceId: args.traceId ?? null,
    };
    if (args.orgId) {
      await withTenant(args.orgId, tx => tx.auditLog.create({ data: record }));
    } else {
      await prisma.auditLog.create({ data: record });
    }
  } catch (err) {
    logger.error({ err, action: args.action }, 'audit write failed');
  }
}
