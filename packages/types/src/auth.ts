import { z } from 'zod';
import { Framework, JoinMode, Level, OrgMode, Plan, Role } from './enums';

// ---------- Register ----------
// Three flows share this endpoint, discriminated by `mode`:
//   SOLO              — existing single-user org. Creates org + admin user;
//                       industry + orgName are required, framework optional.
//   ENTERPRISE_ADMIN  — creates a multi-user org. emailDomain is derived from
//                       the admin's email and locked. Free providers (gmail
//                       etc.) are rejected — admin must use a company email.
//   ENTERPRISE_EMPLOYEE — joins an existing ENTERPRISE org via matching email
//                       domain. orgName/industry/framework are ignored.
export const RegisterMode = {
  SOLO: 'SOLO',
  ENTERPRISE_ADMIN: 'ENTERPRISE_ADMIN',
  ENTERPRISE_EMPLOYEE: 'ENTERPRISE_EMPLOYEE',
} as const;
export type RegisterMode = (typeof RegisterMode)[keyof typeof RegisterMode];

export const RegisterRequest = z
  .object({
    mode: z.nativeEnum(RegisterMode).default(RegisterMode.SOLO),
    email: z.string().email().max(254),
    password: z.string().min(12).max(256),
    name: z.string().min(2).max(120),

    // Required for SOLO + ENTERPRISE_ADMIN, ignored for ENTERPRISE_EMPLOYEE.
    orgName: z.string().min(2).max(120).optional(),
    industry: z.string().min(2).max(80).optional(),
    selectedFramework: z.nativeEnum(Framework).optional(),

    // Optional override for ENTERPRISE_ADMIN (defaults to BOTH).
    joinMode: z.nativeEnum(JoinMode).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode !== 'ENTERPRISE_EMPLOYEE') {
      if (!val.orgName)
        ctx.addIssue({
          code: 'custom',
          path: ['orgName'],
          message: 'orgName is required',
        });
      if (!val.industry)
        ctx.addIssue({
          code: 'custom',
          path: ['industry'],
          message: 'industry is required',
        });
    }
  });
export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const RegisterResponse = z.object({
  orgId: z.string(),
  email: z.string().email(),
  // OTP is only sent for SOLO + ENTERPRISE_ADMIN (creating a new org/user).
  // ENTERPRISE_EMPLOYEE auto-joins an already-verified org and skips OTP —
  // the admin already vouched for the domain.
  otpSent: z.boolean(),
  mode: z.nativeEnum(OrgMode),
  role: z.nativeEnum(Role),
  // devOtp only returned when NODE_ENV === 'development'
  devOtp: z.string().optional(),
});
export type RegisterResponse = z.infer<typeof RegisterResponse>;

// ---------- Verify OTP ----------
export const VerifyOtpRequest = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequest>;

export const VerifyOtpResponse = z.object({
  verified: z.boolean(),
  attemptsRemaining: z.number().int().nonnegative(),
});
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponse>;

// ---------- Login ----------
export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const TokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresAt: z.string().datetime(),
  refreshTokenExpiresAt: z.string().datetime(),
});
export type TokenPair = z.infer<typeof TokenPair>;

// Org block returned anywhere a session is materialised (login, /me, register).
// `mode` tells the mobile app which UI tree to render; `emailDomain` and
// `joinMode` are surfaced for ENTERPRISE admin UIs; `frameworkLocked` gates
// the framework picker on the employee side.
export const SessionOrg = z.object({
  id: z.string(),
  orgName: z.string(),
  industry: z.string(),
  plan: z.nativeEnum(Plan),
  selectedFramework: z.nativeEnum(Framework),
  mode: z.nativeEnum(OrgMode),
  emailDomain: z.string().nullable(),
  joinMode: z.nativeEnum(JoinMode),
  frameworkLocked: z.boolean(),
});
export type SessionOrg = z.infer<typeof SessionOrg>;

export const SessionUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  totpEnabled: z.boolean(),
  // Levels this user is allowed to assess. Admins and SOLO orgs effectively
  // have all three regardless of column value — the API enforces that.
  allowedLevels: z.array(z.nativeEnum(Level)),
});
export type SessionUser = z.infer<typeof SessionUser>;

export const LoginResponse = z.object({
  tokens: TokenPair,
  user: SessionUser,
  org: SessionOrg,
  totpRequired: z.boolean().optional(),
});
export type LoginResponse = z.infer<typeof LoginResponse>;

// ---------- Refresh ----------
export const RefreshRequest = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof RefreshRequest>;

export const RefreshResponse = z.object({
  tokens: TokenPair,
});
export type RefreshResponse = z.infer<typeof RefreshResponse>;

// ---------- Logout ----------
export const LogoutRequest = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutRequest = z.infer<typeof LogoutRequest>;

// ---------- TOTP ----------
export const TotpSetupResponse = z.object({
  otpauthUrl: z.string(),
  qrCodeDataUrl: z.string(),
  recoveryCodes: z.array(z.string()),
});
export type TotpSetupResponse = z.infer<typeof TotpSetupResponse>;

export const TotpVerifyRequest = z.object({
  code: z.string().regex(/^\d{6}$/),
});
export type TotpVerifyRequest = z.infer<typeof TotpVerifyRequest>;

// ---------- Push token ----------
export const PushTokenRequest = z.object({
  expoPushToken: z.string().min(1),
  deviceId: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});
export type PushTokenRequest = z.infer<typeof PushTokenRequest>;

// ---------- Password reset ----------
export const PasswordResetRequestRequest = z.object({
  email: z.string().email().max(254),
});
export type PasswordResetRequestRequest = z.infer<typeof PasswordResetRequestRequest>;

export const PasswordResetConfirmRequest = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(12).max(256),
});
export type PasswordResetConfirmRequest = z.infer<typeof PasswordResetConfirmRequest>;

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(256),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;

// ---------- JWT payload (internal) ----------
export interface JwtPayload {
  sub: string; // user id
  orgId: string;
  role: Role;
  iat: number;
  exp: number;
}

// ---------- /me ----------
export const MeResponse = z.object({
  user: SessionUser,
  org: SessionOrg.extend({ isVerified: z.boolean() }),
  progress: z.object({
    people: z.object({
      status: z.string(),
      lastQuestionIndex: z.number().int(),
      completionPct: z.number(),
    }),
    process: z.object({
      status: z.string(),
      lastQuestionIndex: z.number().int(),
      completionPct: z.number(),
    }),
    company: z.object({
      status: z.string(),
      lastQuestionIndex: z.number().int(),
      completionPct: z.number(),
    }),
  }),
  latestScorecard: z
    .object({
      id: z.string(),
      peopleScore: z.number(),
      processScore: z.number(),
      companyScore: z.number(),
      overallScore: z.number(),
      completeness: z.number(),
      generatedAt: z.string().datetime(),
    })
    .nullable(),
});
export type MeResponse = z.infer<typeof MeResponse>;
