import { z } from 'zod';
import { InviteStatus, Level, ProgressStatus, Role } from './enums';

// ---------- Invite create (admin → employee) ----------
export const CreateInviteRequest = z.object({
  email: z.string().email().max(254),
  role: z.nativeEnum(Role).default(Role.EMPLOYEE),
  // Levels the invitee will inherit on accept. Defaults to all three
  // server-side if omitted, matching the schema default.
  allowedLevels: z.array(z.nativeEnum(Level)).optional(),
});
export type CreateInviteRequest = z.infer<typeof CreateInviteRequest>;

// The raw token is returned exactly once at creation. Admin copies the link
// into Slack/email/whatever and forwards it. We never store the raw token.
export const CreateInviteResponse = z.object({
  inviteId: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  allowedLevels: z.array(z.nativeEnum(Level)),
  token: z.string(),
  inviteUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});
export type CreateInviteResponse = z.infer<typeof CreateInviteResponse>;

// ---------- Invite accept (anonymous, called from deep link) ----------
export const AcceptInviteRequest = z.object({
  token: z.string().min(8),
  name: z.string().min(2).max(120),
  password: z.string().min(12).max(256),
});
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequest>;

// Same shape as LoginResponse — accepting an invite logs the user straight in.
// Re-exported as a fresh symbol so consumers don't have to import from auth.ts.
export const AcceptInviteResponse = z.object({
  inviteId: z.string(),
  orgId: z.string(),
  userId: z.string(),
  // Tokens issued so the mobile client lands authenticated immediately.
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresAt: z.string().datetime(),
  refreshTokenExpiresAt: z.string().datetime(),
});
export type AcceptInviteResponse = z.infer<typeof AcceptInviteResponse>;

// ---------- Invite list / preview ----------
export const InviteSummary = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  allowedLevels: z.array(z.nativeEnum(Level)),
  status: z.nativeEnum(InviteStatus),
  invitedById: z.string().nullable(),
  invitedByName: z.string().nullable(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type InviteSummary = z.infer<typeof InviteSummary>;

// Public-facing preview returned to the accept-invite screen before the user
// has set a password. Shows them which company they're about to join.
export const InvitePreview = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role),
  allowedLevels: z.array(z.nativeEnum(Level)),
  org: z.object({
    id: z.string(),
    orgName: z.string(),
    industry: z.string(),
  }),
  invitedByName: z.string().nullable(),
  expiresAt: z.string().datetime(),
});
export type InvitePreview = z.infer<typeof InvitePreview>;

// ---------- Team list (admin dashboard) ----------
// Per-employee progress + score contribution. Disagreement-with-admin
// signals live in TeamScorecardResponse.consensusSignals (org-wide), not
// here — keeping this list query small and snappy.
export const TeamMember = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  allowedLevels: z.array(z.nativeEnum(Level)),
  joinedAt: z.string().datetime(),
  lastActiveAt: z.string().datetime().nullable(),
  progress: z.object({
    answered: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    completionPct: z.number(),
    status: z.nativeEnum(ProgressStatus),
  }),
  individualScore: z.number().nullable(), // null if no answers yet
});
export type TeamMember = z.infer<typeof TeamMember>;

export const TeamListResponse = z.object({
  members: z.array(TeamMember),
  pendingInvites: z.array(InviteSummary),
});
export type TeamListResponse = z.infer<typeof TeamListResponse>;

// ---------- Team scorecard (admin's aggregated view) ----------
// Returned by /admin/scorecard. Uses ORG-scope responses (admin authoritative)
// + EMPLOYEE-scope responses (averaged across employees) to compute the
// company score. consensusSignals surfaces ORG-scope KPIs where employees
// disagree with the admin in meaningful numbers.
export const ConsensusSignal = z.object({
  kpiId: z.string(),
  kpiName: z.string(),
  adminScore: z.number(),
  // Distribution of employee answers by tier label.
  employeeDistribution: z.array(
    z.object({
      tierLabel: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  // Fraction of employees who picked something different from admin (0..1).
  disagreementRate: z.number(),
});
export type ConsensusSignal = z.infer<typeof ConsensusSignal>;

export const TeamScorecardResponse = z.object({
  overallScore: z.number(),
  completeness: z.number(),
  memberCount: z.number().int().nonnegative(),
  activeAnswerers: z.number().int().nonnegative(),
  consensusSignals: z.array(ConsensusSignal),
});
export type TeamScorecardResponse = z.infer<typeof TeamScorecardResponse>;

// ---------- Update member levels (admin → employee) ----------
export const UpdateMemberLevelsRequest = z.object({
  allowedLevels: z.array(z.nativeEnum(Level)),
});
export type UpdateMemberLevelsRequest = z.infer<typeof UpdateMemberLevelsRequest>;

export const UpdateMemberLevelsResponse = z.object({
  ok: z.literal(true),
  userId: z.string(),
  allowedLevels: z.array(z.nativeEnum(Level)),
});
export type UpdateMemberLevelsResponse = z.infer<typeof UpdateMemberLevelsResponse>;

// ---------- Revoke ----------
export const RevokeMemberResponse = z.object({
  ok: z.literal(true),
  userId: z.string(),
});
export type RevokeMemberResponse = z.infer<typeof RevokeMemberResponse>;

export const RevokeInviteResponse = z.object({
  ok: z.literal(true),
  inviteId: z.string(),
});
export type RevokeInviteResponse = z.infer<typeof RevokeInviteResponse>;
