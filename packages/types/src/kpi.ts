import { z } from 'zod';
import { AnswerScope, Framework, InputType, Level, ScoreRange, SuggestionPriority } from './enums';

// ---------- Scoring tier condition (JSONB) ----------
// Stored structurally — NEVER regex strings.
export const TierCondition = z.discriminatedUnion('op', [
  z.object({ op: z.literal('lte'), value: z.number() }),
  z.object({ op: z.literal('lt'), value: z.number() }),
  z.object({ op: z.literal('gte'), value: z.number() }),
  z.object({ op: z.literal('gt'), value: z.number() }),
  z.object({ op: z.literal('eq'), value: z.union([z.number(), z.string(), z.boolean()]) }),
  z.object({ op: z.literal('range'), min: z.number(), max: z.number() }),
  z.object({ op: z.literal('in'), values: z.array(z.union([z.string(), z.number()])) }),
]);
export type TierCondition = z.infer<typeof TierCondition>;

// ---------- KPI ----------
export const Kpi = z.object({
  id: z.string(),
  kpiName: z.string(),
  level: z.nativeEnum(Level),
  maxScore: z.number().int().positive(),
  weightage: z.number().positive(),
  inputType: z.nativeEnum(InputType),
  infoText: z.string(),
  frameworkCode: z.nativeEnum(Framework),
  nistControlIds: z.array(z.string()),
  isoControlIds: z.array(z.string()),
  isCustom: z.boolean(),
  isActive: z.boolean(),
  version: z.number().int().positive(),
  // ORG-scope = single source of truth, admin authoritative.
  // EMPLOYEE-scope = each employee answers, aggregated at score time.
  answerScope: z.nativeEnum(AnswerScope).default(AnswerScope.ORG),
  tiers: z.array(
    z.object({
      id: z.string(),
      tierLabel: z.string(),
      condition: TierCondition,
      scoreValue: z.number().int().nonnegative(),
      tierOrder: z.number().int().positive(),
    }),
  ),
});
export type Kpi = z.infer<typeof Kpi>;

export const KpiListResponse = z.object({
  items: z.array(Kpi),
  total: z.number().int().nonnegative(),
  cursor: z.string().nullable(),
});
export type KpiListResponse = z.infer<typeof KpiListResponse>;

// ---------- Submit KPI answer ----------
export const SubmitKpiRequest = z.object({
  kpiId: z.string(),
  inputValue: z.string().min(1).max(512),
  // Optional — client-generated idempotency key for offline queue replay
  idempotencyKey: z.string().uuid().optional(),
});
export type SubmitKpiRequest = z.infer<typeof SubmitKpiRequest>;

export const SubmitKpiResponse = z.object({
  responseId: z.string(),
  kpiId: z.string(),
  actualScore: z.number().int(),
  weightedScore: z.number(),
  matchedTierId: z.string().nullable(),
  submittedAt: z.string().datetime(),
});
export type SubmitKpiResponse = z.infer<typeof SubmitKpiResponse>;

// ---------- Evidence presign ----------
export const EvidencePresignRequest = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(127),
  fileSize: z.number().int().positive().max(20 * 1024 * 1024), // 20 MB cap
});
export type EvidencePresignRequest = z.infer<typeof EvidencePresignRequest>;

export const EvidencePresignResponse = z.object({
  uploadUrl: z.string().url(),
  fileKey: z.string(),
  expiresAt: z.string().datetime(),
  method: z.enum(['PUT']),
  headers: z.record(z.string(), z.string()),
});
export type EvidencePresignResponse = z.infer<typeof EvidencePresignResponse>;

export const EvidenceConfirmRequest = z.object({
  fileKey: z.string(),
  fileName: z.string(),
  fileType: z.string(),
});
export type EvidenceConfirmRequest = z.infer<typeof EvidenceConfirmRequest>;

// ---------- N/A ----------
export const MarkNaRequest = z.object({
  kpiId: z.string(),
  justification: z.string().min(10).max(2000),
});
export type MarkNaRequest = z.infer<typeof MarkNaRequest>;

// ---------- Suggestion ----------
export const KpiSuggestion = z.object({
  id: z.string(),
  kpiId: z.string(),
  scoreRange: z.nativeEnum(ScoreRange),
  suggestionText: z.string(),
  priority: z.nativeEnum(SuggestionPriority),
});
export type KpiSuggestion = z.infer<typeof KpiSuggestion>;
