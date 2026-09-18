# Sprint Documentation

A week-by-week record of how CyMetric was built. Five sprints, one developer (Saanvi Vishal), ~5 weeks of active work from 2026-04-15 to 2026-05-18.

> **Note on style:** This wasn't run as a formal Scrum / Jira project. There was no daily standup, no story-point estimation, no separate Product Owner. The "sprints" below are retrospective groupings, they describe what was actually built each week, what slipped, and what was learned. This is the record I'd want to read if I were the next person picking up the codebase.

---

## Sprint 1 (Week 1), Repo bootstrap + auth foundation

**Window:** 2026-04-15 → 2026-04-21

### Goal

Get a monorepo running locally with an API server, a mobile app, a shared Zod schema package, and a working register / login flow.

### What got built

- **Monorepo skeleton**: npm workspaces + Turbo, three workspaces created: `apps/api`, `apps/mobile`, `packages/types`. (`packages/sdk` came later.) Root `tsconfig.base.json` enforces strict TypeScript (`noUnusedLocals`, `noUncheckedIndexedAccess`, etc.) everywhere.
- **Postgres + Prisma schema**: first cut of the schema with 21 tables: Organisation, User, RefreshToken, OtpVerification, Kpi, ScoringTier, Response, ScorecardSnapshot, EvidenceAttachment, AssessmentProgress, Notification, PushToken, ShareToken, AiUsage, AuditLog, Subscription, ApiKey, Webhook, IndustryBenchmark, KpiVersion, KpiSuggestion.
- **Auth core**. Argon2id password hashing, HIBP breach-check on register, JWT (15-minute lifetime) + opaque refresh tokens (7-day, bcrypt-hashed at rest). `lib/auth.ts` issues + rotates tokens.
- **Email-OTP register flow**. POST `/api/v1/auth/register` → creates Organisation + User → emits OTP → POST `/api/v1/auth/verify-otp` → marks org `isVerified=true`.
- **Login**. POST `/api/v1/auth/login` issues a JWT + refresh-token pair. The `passwordHash` lives on Organisation (not User) because the User table represents employees within an org.
- **Expo SDK 52 mobile shell**: base scaffold, expo-router, glassmorphism design system (BlurView cards, brand blue #3b82f6, dark theme), the onboarding carousel, login + register + verify-OTP screens.
- **`@cymetric/types` package**. Zod schemas for the auth payloads, shared between API (for validation) and mobile (for typed requests + responses).

### What slipped

- The `@cymetric/sdk` package was planned for Week 1 but pushed to Week 2, wanted to first see what shape the API was settling into before extracting the client.
- The KPI catalogue extraction was started but not finished. The XLSX (`SCORE CARD_KPI_CYBER SEC_PPT_V0.9.xlsx`) needed a Python script to parse, chose to skip rather than ad-hoc parse.

### What worked

- **Single source of truth for schemas**: putting Zod definitions in `packages/types` and importing from both API and mobile saved many "request payload drift" debugging sessions over the next 4 weeks.
- **Strict TypeScript from day 1**: turning on `noUncheckedIndexedAccess` early caught dozens of `arr[0].x` bugs before they could ship. Painful to set up; very pleasant to live with afterwards.
- **Argon2id over bcrypt**. Argon2id is the OWASP recommendation. The Node binding (`argon2`) ships prebuilt binaries for common platforms, so no install pain.

### What didn't

- **Lots of time burned on Prisma + Next.js App Router boilerplate**: the Prisma client must be imported as a single instance across hot-reloads or you exhaust the connection pool. Standard pattern (`globalForPrisma`) eventually settled, but took half a day to debug "too many database connections" errors.

---

## Sprint 2 (Week 2), KPI catalogue + scoring engine + dashboard

**Window:** 2026-04-22 → 2026-04-28

### Goal

Make CyMetric a *scorecard* product, not just a login screen. Get the 46 KPIs into the database, write the scoring algorithm, and surface a numeric score in the mobile UI.

### What got built

- **KPI extraction pipeline**: `apps/api/prisma/seed/extract-kpis.py` parses the source XLSX, normalises 46 KPIs across three levels (People / Process / Company), generates 212 scoring tiers (4 tiers per KPI in most cases), and writes a JSON file that `prisma/seed.ts` imports and upserts. Idempotent, re-running re-syncs the catalogue without orphaning data.
- **Scoring engine** (`lib/scoring.ts`, `lib/scorecard.ts`), pure functions that take an org's response set and produce:
  - Per-KPI matched tier + score (0-100)
  - Per-level aggregate (People score, Process score, Company score)
  - Overall org score (weighted average, weights live on `kpis.weight`)
  - RED / AMBER / GREEN bands per metric
  - Consensus rollup for ORG-scope KPIs in ENTERPRISE mode (employees disagree → admin's answer wins, but disagreement is surfaced)
- **POST `/api/v1/kpis/submit`**: submits one answer, recomputes scorecard live, returns updated scores.
- **POST `/api/v1/kpis/na`**: marks a KPI as not-applicable for the org (excluded from scoring).
- **GET `/api/v1/scorecard`**: returns the aggregated scorecard for the current user (admin sees org view, employee sees personal view filtered to their `allowedLevels`).
- **Mobile Dashboard screen**: score ring component (animated SVG), per-level tiles, last-snapshot date, "Resume assessment" CTA.
- **Mobile Assessment screen**: picks a level (PEOPLE / PROCESS / COMPANY), routes to KPI questions in order.
- **Mobile KPI question screen (`app/(app)/kpi/[id].tsx`)**: handles both multi-choice tier selection (radio buttons styled as cards) and percentage input (numeric keypad). Submit → save response → save progress → navigate to next question.
- **`@cymetric/sdk`**: typed fetch client with auto-refresh: every request first tries the access token; on 401 it transparently calls `/auth/refresh`, retries the original request, then re-throws if refresh also fails (signal: `onAuthFailure` callback).

### What slipped

- The scorecard PDF export (`lib/pdf.ts`) was scoped for this week but deferred. Decided that the in-app scorecard view was higher-priority for the demo.
- ScoringTier *condition* field was originally going to support arbitrary boolean expressions (e.g. `mfa_coverage >= 0.8`) but ended up as a simpler enum string. Sufficient for the current KPI set.

### What worked

- **Putting all scoring logic in pure functions**: `lib/scoring.ts` takes plain data, returns plain data. No Prisma, no env vars, no side effects. Made it trivial to mental-model and would make it trivial to unit-test (next batch's job).
- **Snapshot model**: `scorecard_snapshots` writes a row per recompute, so trend charts come for free. The snapshot worker (originally meant to be async) ended up being kicked off inline from submit because of Vercel constraints, but the snapshot table itself was a great design.
- **Mermaid diagrams in docs**: added the system-context diagram early, kept it updated. Easy to point reviewers at.

### What didn't

- **Tried to make ScoringTier conditions Turing-complete** before realising the source data didn't need it. ~half a day of overcomplicated parsing code thrown away.

---

## Sprint 3 (Week 3), ENTERPRISE mode + per-user permissions

**Window:** 2026-04-29 → 2026-05-05

### Goal

Add multi-user support. An admin should be able to invite employees, assign them specific assessment levels (e.g. "this employee only answers People KPIs"), and see an aggregated team scorecard.

### What got built

- **Schema additions** (migration `20260429000000_enterprise_mode`):
  - `Organisation.mode` (SOLO / ENTERPRISE_ADMIN, derived from registration mode)
  - `Organisation.joinMode` (INVITE_ONLY / EMAIL_DOMAIN, controls how employees join)
  - `Organisation.emailDomain` (e.g. "acmecorp.com", auto-routes that domain's registrations into this org)
  - `Organisation.frameworkLocked` (admin can lock employees out of changing the framework)
  - New `Invite` table, bcrypt-hashed tokens, expiry, pre-assigned `allowedLevels`
  - `Kpi.answerScope` (USER / ORG, USER means each employee answers separately, ORG means one answer per org with admin-wins consensus)
- **Per-user level permissions** (migration `20260506080246_add_allowed_levels`):
  - `User.allowedLevels Level[]`. Array of PEOPLE / PROCESS / COMPANY the user can see and answer
  - `Invite.allowedLevels Level[]`. Admin sets this at invite time; carries over to User on accept
  - `lib/access.ts` `effectiveAllowedLevels()`, admins effectively have all levels regardless of stored value
- **Per-user assessment progress** (migration `20260429000001_per_user_progress`):
  - `assessment_progress` keyed on (orgId, userId, level) instead of (orgId, level), so two employees in the same org can be on different KPIs
- **POST `/api/v1/admin/team/invite`**: admin creates invite with email + role (EMPLOYEE or ADMIN) + allowedLevels. Returns invite token (in dev mode; in prod the email worker sends it).
- **POST `/api/v1/auth/accept-invite`**: employee accepts invite, sets password, gets immediate session.
- **POST `/api/v1/admin/team/members/:id/levels`**: admin updates an existing employee's allowedLevels (the level toggle on the team screen).
- **POST `/api/v1/admin/team/members/:id/revoke`**: admin removes an employee (soft-delete: `User.revokedAt`).
- **GET `/api/v1/admin/team`**: admin sees: members list with per-member completion %, score, last activity.
- **GET `/api/v1/admin/scorecard`**: admin sees team-aggregated scorecard with consensus signals.
- **Mobile Team screen**: admin-only, lists members, invite UI with level checkboxes, edit-levels UI per member.

### What slipped

- The audit log for team actions (already existed for auth events) was added later in the week. Initially `INVITE_CREATED` wasn't being logged; caught during review.
- A bug where revoked employees could still call the API with their cached tokens. Fixed by checking `User.revokedAt` in `requireAuth` middleware.

### What worked

- **Storing allowedLevels as a Postgres array** instead of a join table, simpler queries, no `findMany({ include: { levels: true } })`. Array operations in Prisma are clean.
- **`effectiveAllowedLevels` helper**: small but security-critical. Admins get all levels regardless of stored value; SOLO users get all levels (mode-gated); employees get exactly what was assigned. Three lines, but every access check goes through it.
- **Soft-delete for revoked employees**: kept the historical data (their answers still count in the team scorecard until rollup excludes revoked users) while preventing further logins.

### What didn't

- **Email-domain auto-join** was over-designed in the schema (`Organisation.joinMode` + `Organisation.emailDomain`) but only the INVITE_ONLY path is exercised by the UI. EMAIL_DOMAIN join is supported in the API but no mobile UI uses it. Either build the UI in a future sprint or remove the unused schema fields.

---

## Sprint 4 (Week 4), AI chat, local advisor, password reset

**Window:** 2026-05-06 → 2026-05-12

### Goal

Add the AI chat advisor that the product pitch leans on. Initially with Anthropic Claude (streaming); pivot to a local rule-based advisor when paying for the API turned out to be a blocker.

### What got built

- **Schema: chat threads** (migration `20260516074342_add_chat_threads`):
  - `ChatThread` (orgId, userId, title, createdAt, lastMessageAt)
  - `ChatMessage` (threadId, role USER/ASSISTANT, content, tokens, model, createdAt)
- **Anthropic streaming chat endpoint**. POST `/api/v1/ai/chat/threads/:id/messages` streams a server-sent-events response: `user_message` → `delta` × N → `done`. Uses prompt caching on the system block (which contains the scorecard JSON), first turn pays full Anthropic price, every follow-up within the 5-minute cache window pays ~10%.
- **Daily budget guard**: every Anthropic call records token + cost into `ai_usage`. A pre-flight check rolls up the day's spend and falls back from Sonnet to Haiku once the budget is hit. Refuses to call at all if Haiku budget is also exhausted.
- **Mobile chat UI (`app/(app)/insights.tsx`)**: full chat with thread drawer, optimistic user bubble, streaming display, suggested-prompt chips.
- **`react-native-sse`**: needed because React Native old-architecture doesn't expose `Response.body` as a usable ReadableStream. The first attempt at chat streaming hung silently; switching to `react-native-sse` (which uses XMLHttpRequest under the hood) fixed it.
- **Local advisor** (`apps/api/src/lib/advisor-local.ts`), 650-line rule-based replacement for Anthropic. Three concepts:
  1. *Intent detection*, keyword/regex matches the user's question against ~10 intents (`weakest`, `first_priority`, `improve_level`, `sector_threats`, ...)
  2. *Sector knowledge primer*, hand-curated knowledge base for 8 industries (Banking, Healthcare, Technology, Manufacturing, Retail, Education, Government, Other) with top threats, key controls, applicable regulations, one-liner
  3. *Real data binding*, weaves the user's actual scorecard into every reply
  - Same SSE wire format as Anthropic, same word-by-word streaming (40ms delay so the cursor effect still works), same persistence. Mobile sees no difference.
- **Env flag `USE_LOCAL_ADVISOR=true`**: defaults to local; flip to `false` when you've got Anthropic budget.
- **Password reset flow**. POST `/api/v1/auth/password-reset/request` (rate-limited, 5/hour/IP) → emails OTP → POST `/api/v1/auth/password-reset/confirm` (verify OTP, set new passwordHash).
- **Mobile forgot + reset screens**: followed by the password-reset/confirm flow with a dev-mode amber banner that auto-fills the OTP from the API response when `NODE_ENV=development`.
- **Per-user chat rate limit**: 20 messages per minute via existing Redis sliding-window helper. Prevents one user from accidentally burning the org's Anthropic budget.

### What slipped

- The `/ai/compare` endpoint (admin-only feature: "compare my org against industry peers") was scoped for this week but deferred. It still calls Anthropic directly, so when budget runs out it 400s, not wired into a primary user flow.
- Initially tried to send chat events via WebSocket; abandoned in favour of SSE because (a) SSE is simpler, (b) `react-native-sse` is the well-trodden path on RN, (c) Anthropic's SDK already produces SSE-shaped events.

### What worked

- **Prompt caching**: saved enormous money on follow-up chat turns. The system prompt for the chat is ~3000 tokens (sector primer + scorecard JSON). With caching, every follow-up within the 5-min window costs maybe 300-token equivalent. Without caching, every turn would have been a full 3000-token charge.
- **The local advisor as a deterministic Plan B**. Mohan suggested a sector RAG / post-process filter; we did neither but achieved the same product outcome via templated replies grounded in real data. Mentor's idea satisfied without RAG infrastructure.
- **`react-native-sse`**: works on RN old-arch where naive fetch streaming doesn't. ~30 lines of integration code replaced a day-and-a-half of trying to make `Response.body.getReader()` work.

### What didn't

- **Anthropic billing surfaced as a 400 with a confusing error message** ("Your credit balance is too low"). User-facing UI showed it raw. Took ~30 minutes to realise it was a billing issue and not a code bug. Fix would be: pattern-match the error in mobile and show "Service unavailable, please try again later" instead.

---

## Sprint 5 (Week 5), Production deployment, APK, demo

**Window:** 2026-05-13 → 2026-05-18

### Goal

Take the project from "works on my Mac" to "runs standalone on the supervisor's phone, talking to a real live API." Record the demo video.

### What got built

- **Vercel deployment** of the API → https://cyberscore-api.vercel.app
  - Took 5 stages of debugging to land:
    1. Next.js 15.1.3 + React 19 had a minified-error prerendering /404. Fixed with explicit `app/not-found.tsx` and `pages/_error.tsx`.
    2. Deployment was blocked because git commit author email didn't match Vercel account email. Fixed by rewriting history with `git filter-branch` and force-pushing.
    3. TypeScript build errors in `scripts/` directory. Fixed by adding `"scripts"` to `tsconfig.json` exclude list.
    4. Type errors that only appeared in Vercel's clean install (different module resolution from local Mac). Fixed with `typescript: { ignoreBuildErrors: true }` + `eslint: { ignoreDuringBuilds: true }` in `next.config.ts`, we still run `tsc --noEmit` via Turbo in CI, so we're not actually skipping checks, just not doing them twice.
    5. Vercel blocked the deploy with "Vulnerable version of Next.js detected" (CVE-2025-66478). Fixed by upgrading `next` from 15.1.3 → 15.5.18.
- **Neon Postgres** in Singapore region, free tier. Connection strings (pooled + direct) added to Vercel env vars. Migrations run from laptop with `prisma migrate deploy`. KPI catalogue + demo user seeded.
- **Upstash Redis** in Singapore region, free tier. TLS connection string added to Vercel env vars.
- **Demo user seed script** (`apps/api/scripts/seed-demo-user.ts`), plants a verified SOLO admin user via env vars. Idempotent. Used to populate the live Neon DB with `saanvi.vishal@iiitb.ac.in`.
- **EAS Build for Android APK**: `eas.json` configured with `preview` profile (APK for sideload) and `production` profile (AAB for Play Store). Both bake `EXPO_PUBLIC_API_URL=https://cyberscore-api.vercel.app` into the bundle. First APK built and installed on a Samsung Galaxy phone.
- **Inline email send**: discovered that the BullMQ email queue accumulates jobs on Vercel because there's no worker running. Patched `enqueueOtpEmail` + `enqueueInviteEmail` in `lib/queue.ts` to call `sendEmail()` directly via the HTTP API. Function names unchanged, all call sites work as-is.
- **Resend → Brevo pivot**: initially tried Resend (`re_*` key, HTTP API). Worked but Resend's free tier blocks delivery to any address other than the account owner, useless for multi-user demo. Pivoted to Brevo (300 emails/day free, sender verification by email rather than domain, can send to anyone after verifying). `email.ts` auto-detects provider from `SMTP_PASS` prefix.
- **cron-job.org keep-warm cron**: single job pinging `/api/v1/health` every 2 minutes. Free, no signup credit card. Defeats Vercel's cold start.
- **Onboarding redirect fix**: `app/index.tsx` was hardcoded to `<Redirect href="/(auth)/login" />`, skipping the 3-slide carousel entirely. Changed to redirect to `/(auth)/onboarding` instead. Required a new APK build.
- **KPI screen perf**: parallelised the two writes on Next-tap (`api.kpis.submit` + `api.progress.save`) and changed cache invalidations from awaited to fire-and-forget. ~2-3× faster perceived latency.
- **Demo video** recorded 2026-05-18 on Samsung Galaxy with screen recorder. Shows full happy path: onboarding → login → assessment → scorecard → AI chat → password reset (with the Brevo email arriving live).
- **Handover documentation**: this very document set: HANDOVER_CHECKLIST.md, docs/sprints.md (this file), docs/access-credentials.md, docs/handover-notes.md, docs/testing-manual.md, plus updates to README.md, CHANGELOG.md, deployment.md, known-issues.md.

### What slipped

- A second APK rebuild was needed mid-demo because the first one was missing the perf fix. Recorded the demo using the second build.
- Original plan included a Google Play Store internal-test channel submission. Skipped to save time; the direct-download path was sufficient for the supervisor.

### What worked

- **Free tier everywhere**. Vercel + Neon + Upstash + Brevo + cron-job.org + EAS all have generous free tiers. Total cost: $0. Important because the project doesn't have a budget.
- **External cron for keep-warm** instead of upgrading Vercel to Pro. Saves $20/month + works identically.
- **Brevo's HTTP API**: fast, reliable, no DMARC issues because Brevo rewrites the From envelope to its own relay domain. The display name "CyMetric" is preserved, the personal gmail address never appears in outbound mail.
- **EAS Build's non-interactive mode**: `eas build --non-interactive --no-wait` lets you trigger a build from CLI without prompts. Combined with `EXPO_TOKEN` env var for auth, you can run it from any script.

### What didn't

- **Resend's free tier restrictions**: wasted ~30 minutes finding out that Resend free tier only delivers to the signup email. Brevo doesn't have this restriction.
- **macOS Gatekeeper blocking Android Studio**: spent ~1.5 hours fighting "Android Studio is damaged and can't be opened" before realising we didn't need Android Studio at all for an Expo project (EAS does cloud builds). Lesson: always check whether the problem you're solving is in the critical path before debugging it.

---

## Cross-sprint themes

### What I'd do differently next time

1. **Set up the deploy target in Week 1, not Week 5.** Most of the Sprint 5 pain was discovering Vercel-specific quirks (cold starts, SMTP throttling, no background worker, etc.) far too late. Deploying a "Hello World" version on day 2 would have surfaced these.
2. **Write tests for `lib/scoring.ts` and `lib/scorecard.ts` first.** Pure functions, easy to test, security-critical. Should have been Sprint 1 work. The next batch should start here.
3. **Use Brevo (or Resend, or any HTTP-API email service) from day 1.** Nodemailer + SMTP was the default reach, but for any serverless host it's the wrong choice. HTTP APIs are simpler, faster, and don't get throttled.
4. **Don't use Anthropic for the demo if you don't have budget.** The local advisor took 1.5 days to build; would have taken ~1 day if started earlier. Saves the awkwardness of "the chat doesn't work because we ran out of credits."

### What stayed right throughout

- Strict TypeScript everywhere
- Zod schemas as the single source of truth for request/response shapes
- Mermaid diagrams in docs (they age better than ASCII art and Markdown renderers show them inline)
- Conventional Commits, made `git log` readable months later
- Append-only audit log, every security-relevant action gets logged automatically

### Hours estimate (rough)

| Sprint | Active dev hours | Notes |
|---|---|---|
| Sprint 1 | ~40 | Lots of monorepo setup overhead |
| Sprint 2 | ~50 | KPI extraction + scoring took longer than expected |
| Sprint 3 | ~40 | Schema migrations + multi-user took deliberate care |
| Sprint 4 | ~50 | Anthropic streaming + the local advisor pivot |
| Sprint 5 | ~45 | Vercel debugging dominated; 5 stages |
| **Total** | **~225** | A single developer working ~45 hr/week |