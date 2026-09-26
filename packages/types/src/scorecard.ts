import { z } from 'zod';
import { Level, ProgressStatus, ScoreRange, SuggestionPriority } from './enums';

// ---------- Scorecard (live) ----------
export const ScorecardResponse = z.object({
  peopleScore: z.number(),
  processScore: z.number(),
  companyScore: z.number(),
  overallScore: z.number(),
  completeness: z.number(), // 0..100 — how many KPIs answered
  colorBand: z.nativeEnum(ScoreRange),
  levelBreakdown: z.object({
    people: z.object({
      score: z.number(),
      maxPossible: z.number(),
      answered: z.number().int(),
      total: z.number().int(),
      colorBand: z.nativeEnum(ScoreRange),
    }),
    process: z.object({
      score: z.number(),
      maxPossible: z.number(),
      answered: z.number().int(),
      total: z.number().int(),
      colorBand: z.nativeEnum(ScoreRange),
    }),
    company: z.object({
      score: z.number(),
      maxPossible: z.number(),
      answered: z.number().int(),
      total: z.number().int(),
      colorBand: z.nativeEnum(ScoreRange),
    }),
  }),
  improvementSuggestions: z.array(
    z.object({
      kpiId: z.string(),
      kpiName: z.string(),
      currentScore: z.number(),
      scoreRange: z.nativeEnum(ScoreRange),
      suggestions: z.array(
        z.object({
          text: z.string(),
          priority: z.nativeEnum(SuggestionPriority),
        }),
      ),
    }),
  ),
  latestSnapshot: z
    .object({
      id: z.string(),
      generatedAt: z.string().datetime(),
    })
    .nullable(),
});
export type ScorecardResponse = z.infer<typeof ScorecardResponse>;

// ---------- History ----------
export const ScorecardSnapshot = z.object({
  id: z.string(),
  peopleScore: z.number(),
  processScore: z.number(),
  companyScore: z.number(),
  overallScore: z.number(),
  completeness: z.number(),
  feedbackText: z.string().nullable(),
  generatedAt: z.string().datetime(),
});
export type ScorecardSnapshot = z.infer<typeof ScorecardSnapshot>;

export const HistoryResponse = z.object({
  items: z.array(ScorecardSnapshot),
});
export type HistoryResponse = z.infer<typeof HistoryResponse>;

// ---------- Progress ----------
export const ProgressLevel = z.object({
  level: z.nativeEnum(Level),
  status: z.nativeEnum(ProgressStatus),
  lastQuestionIndex: z.number().int().nonnegative(),
  pausedAt: z.string().datetime().nullable(),
  completionPct: z.number(),
});
export type ProgressLevel = z.infer<typeof ProgressLevel>;

export const ProgressResponse = z.object({
  levels: z.array(ProgressLevel),
});
export type ProgressResponse = z.infer<typeof ProgressResponse>;

export const SaveProgressRequest = z.object({
  level: z.nativeEnum(Level),
  lastQuestionIndex: z.number().int().nonnegative(),
  status: z.nativeEnum(ProgressStatus),
});
export type SaveProgressRequest = z.infer<typeof SaveProgressRequest>;

// ---------- Share ----------
export const CreateShareRequest = z.object({
  expiresInDays: z.number().int().min(1).max(90).default(30),
  feedbackText: z.string().max(2000).optional(),
});
export type CreateShareRequest = z.infer<typeof CreateShareRequest>;

export const CreateShareResponse = z.object({
  token: z.string(),
  shareUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});
export type CreateShareResponse = z.infer<typeof CreateShareResponse>;
