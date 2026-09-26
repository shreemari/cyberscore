import { z } from 'zod';

// Structured AI output — validated server-side before returning to client.
// Prompt-injection hardening: all user-entered fields are wrapped in
// <user_content>...</user_content> tags on the server. The system prompt
// instructs Claude to ignore any instructions found inside those tags.

export const AiPriority = z.object({
  kpiName: z.string(),
  currentScore: z.number(),
  industryAverage: z.number().nullable(),
  gap: z.number(),
  action: z.string().min(10).max(600),
  estimatedImpact: z.enum(['HIGH', 'MEDIUM', 'LOW']),
});
export type AiPriority = z.infer<typeof AiPriority>;

export const AiRiskFlag = z.object({
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM']),
  title: z.string().min(4).max(120),
  description: z.string().min(10).max(600),
  relatedKpiNames: z.array(z.string()).max(10),
});
export type AiRiskFlag = z.infer<typeof AiRiskFlag>;

export const AiCompareResponse = z.object({
  comparisonSummary: z.string().min(20).max(1200),
  threePriorities: z.array(AiPriority).length(3),
  riskFlags: z.array(AiRiskFlag).max(5),
  dailyUsageRemaining: z.number().int().nonnegative(),
  modelUsed: z.string(),
  generatedAt: z.string().datetime(),
});
export type AiCompareResponse = z.infer<typeof AiCompareResponse>;

export const AiCompareRequest = z.object({
  includeRiskFlags: z.boolean().default(true),
});
export type AiCompareRequest = z.infer<typeof AiCompareRequest>;

// ---------- Chat (conversational AI advisor) ----------

export const ChatRole = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT',
} as const;
export type ChatRole = (typeof ChatRole)[keyof typeof ChatRole];

export const ChatThread = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Convenience preview — last message text, capped, for the thread list UI.
  lastMessagePreview: z.string().nullable(),
});
export type ChatThread = z.infer<typeof ChatThread>;

export const ChatMessage = z.object({
  id: z.string(),
  role: z.nativeEnum(ChatRole),
  content: z.string(),
  createdAt: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

// ---- Thread CRUD ----
export const CreateChatThreadRequest = z.object({
  // Optional title; defaults to "New chat" until the first user message,
  // after which the API renames the thread to a short summary.
  title: z.string().min(1).max(200).optional(),
});
export type CreateChatThreadRequest = z.infer<typeof CreateChatThreadRequest>;

export const RenameChatThreadRequest = z.object({
  title: z.string().min(1).max(200),
});
export type RenameChatThreadRequest = z.infer<typeof RenameChatThreadRequest>;

export const ChatThreadListResponse = z.object({
  threads: z.array(ChatThread),
});
export type ChatThreadListResponse = z.infer<typeof ChatThreadListResponse>;

export const ChatMessageListResponse = z.object({
  thread: ChatThread,
  messages: z.array(ChatMessage),
});
export type ChatMessageListResponse = z.infer<typeof ChatMessageListResponse>;

// ---- Streaming ----
// Send a single user turn. Server appends the user message, then streams
// the assistant response back as SSE (see ChatStreamEvent below).
export const SendChatMessageRequest = z.object({
  content: z.string().min(1).max(4000),
});
export type SendChatMessageRequest = z.infer<typeof SendChatMessageRequest>;

// SSE event envelope. The mobile client parses each `data:` line as JSON
// and switches on `type`. We deliberately keep the schema flat — no
// nested deltas — so a minimal parser handles every case.
export type ChatStreamEvent =
  // The persisted user message row id, emitted immediately so the client
  // can swap its optimistic message for the canonical row.
  | { type: 'user_message'; messageId: string; createdAt: string }
  // Stream chunks — concatenate `text` into the in-flight assistant bubble.
  | { type: 'delta'; text: string }
  // Terminal success — full assistant message persisted, includes token usage.
  | {
      type: 'done';
      messageId: string;
      createdAt: string;
      modelUsed: string;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheCreationTokens: number;
    }
  // Terminal error — code maps to ErrorCodes (AUTH_RATE_LIMITED,
  // AI_BUDGET_EXHAUSTED, INTERNAL, etc.). Mobile shows a friendly toast.
  | { type: 'error'; code: string; message: string };
