export const Level = {
  PEOPLE: 'PEOPLE',
  PROCESS: 'PROCESS',
  COMPANY: 'COMPANY',
} as const;
export type Level = (typeof Level)[keyof typeof Level];

export const Role = {
  EMPLOYEE: 'EMPLOYEE',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Framework = {
  EXCEL: 'EXCEL',
  NIST_CSF: 'NIST_CSF',
  ISO27001: 'ISO27001',
} as const;
export type Framework = (typeof Framework)[keyof typeof Framework];

export const Plan = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  GROWTH: 'GROWTH',
  ENTERPRISE: 'ENTERPRISE',
} as const;
export type Plan = (typeof Plan)[keyof typeof Plan];

export const InputType = {
  PERCENTAGE: 'PERCENTAGE',
  DROPDOWN: 'DROPDOWN',
  RADIO: 'RADIO',
} as const;
export type InputType = (typeof InputType)[keyof typeof InputType];

export const ProgressStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type ProgressStatus = (typeof ProgressStatus)[keyof typeof ProgressStatus];

export const ScoreRange = {
  RED: 'RED',
  AMBER: 'AMBER',
  GREEN: 'GREEN',
} as const;
export type ScoreRange = (typeof ScoreRange)[keyof typeof ScoreRange];

export const SuggestionPriority = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
} as const;
export type SuggestionPriority = (typeof SuggestionPriority)[keyof typeof SuggestionPriority];

export const KpiStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type KpiStatus = (typeof KpiStatus)[keyof typeof KpiStatus];

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  TRIALING: 'TRIALING',
  PAST_DUE: 'PAST_DUE',
  CANCELLED: 'CANCELLED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

// SOLO  = single-user org (existing flow). One user creates the org, fills
//         every KPI, and sees their own scorecard. Best fit for startups.
// ENTERPRISE = multi-user org. Admin creates the org and locks the
//         framework; employees join via domain or invite and answer KPIs
//         within their scope. Admin sees an aggregated team scorecard.
export const OrgMode = {
  SOLO: 'SOLO',
  ENTERPRISE: 'ENTERPRISE',
} as const;
export type OrgMode = (typeof OrgMode)[keyof typeof OrgMode];

// How non-admin users get into an ENTERPRISE org.
export const JoinMode = {
  INVITE_ONLY: 'INVITE_ONLY',
  DOMAIN_AUTO: 'DOMAIN_AUTO',
  BOTH: 'BOTH',
} as const;
export type JoinMode = (typeof JoinMode)[keyof typeof JoinMode];

// ORG    — single ground truth (admin authoritative; employees are a signal).
// EMPLOYEE — every employee answers for themselves; aggregated at score time.
export const AnswerScope = {
  ORG: 'ORG',
  EMPLOYEE: 'EMPLOYEE',
} as const;
export type AnswerScope = (typeof AnswerScope)[keyof typeof AnswerScope];

export const InviteStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;
export type InviteStatus = (typeof InviteStatus)[keyof typeof InviteStatus];

// Free-email blocklist — orgs can't claim these as their company domain.
// Anyone signing up with one of these is forced into SOLO mode.
export const FREE_EMAIL_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'ymail.com',
  'rocketmail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'outlook.co.uk',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'mail.com',
  'gmx.com',
  'gmx.de',
  'zoho.com',
  'fastmail.com',
  'tutanota.com',
  'tutanota.de',
  'duck.com',
  'qq.com',
  '163.com',
  '126.com',
  'yandex.com',
  'yandex.ru',
]);

export function emailDomainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).trim().toLowerCase() : '';
}

export function isFreeEmailDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain.trim().toLowerCase());
}

// Score thresholds per spec §1.3
export const SCORE_THRESHOLDS = {
  GREEN: 75,
  AMBER: 50,
} as const;

export function scoreRangeFor(percentage: number): ScoreRange {
  if (percentage >= SCORE_THRESHOLDS.GREEN) return ScoreRange.GREEN;
  if (percentage >= SCORE_THRESHOLDS.AMBER) return ScoreRange.AMBER;
  return ScoreRange.RED;
}
