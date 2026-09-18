# Requirements

## 1. Product summary

**CyMetric** is a mobile-first SaaS that lets organisations self-assess cybersecurity posture across 46 KPIs spanning three dimensions, **People**, **Process**, and **Company**: and surfaces an AI advisor for personalised remediation.

The product targets two operating modes:
- **SOLO**: single-user org for small teams (4 to 5 people)
- **ENTERPRISE**: multi-user org with an admin + employees, framework locked, optional team-level rollup

The KPI set is mapped to **NIST CSF 2.0** and **ISO 27001** control families; orgs can choose which framework lens to view their scorecard through.

## 2. User roles & permissions

| Role | Mode | Capabilities |
|---|---|---|
| **SOLO user** | SOLO | Effectively an admin of a single-user org. Full access to all features. |
| **ENTERPRISE_ADMIN** | ENTERPRISE | Self-assess, invite employees, set per-user `allowedLevels`, view team rollup + consensus signals, edit KPIs (custom org-specific KPIs), manage framework + billing |
| **MANAGER** | ENTERPRISE | Like ADMIN but cannot invite ADMINs or change the framework |
| **EMPLOYEE** | ENTERPRISE | Self-assess only the assessment levels the admin assigned. Cannot see team rollup, cannot edit KPIs, cannot change framework. |

Within ENTERPRISE, the admin sets each employee's `allowedLevels Level[]` (any subset of `{PEOPLE, PROCESS, COMPANY}`). Employees with zero levels are locked out of the assessment until reassigned. Admins always have all three regardless of column value (enforced by `effectiveAllowedLevels()`).

## 3. Functional requirements

### 3.1 Authentication & onboarding

| ID | Requirement |
|---|---|
| FR-AUTH-1 | Users can register in one of three modes: SOLO, ENTERPRISE_ADMIN (creates a new company keyed by email domain), ENTERPRISE_EMPLOYEE (auto-joins by email domain match) |
| FR-AUTH-2 | Registration is gated by a 6-digit OTP sent to the registering email. OTP expires in 10 minutes, max 5 attempts. In production the OTP is delivered through Brevo's HTTPS REST API (auto-detected from the `SMTP_PASS` prefix). In local development without a Brevo key the OTP is returned inline in the API response so testing works without any SMTP setup. |
| FR-AUTH-3 | Free email providers (gmail, yahoo, etc.) are rejected for ENTERPRISE_ADMIN registration |
| FR-AUTH-4 | Passwords must be ≥12 characters; the API checks them against the Have I Been Pwned k-anonymity API and rejects breached passwords |
| FR-AUTH-5 | Login issues a short-lived JWT (15min) + a longer-lived refresh token (7d). The mobile SDK refreshes transparently on 401. |
| FR-AUTH-6 | Users can enable TOTP-based 2FA. Secret encrypted at rest with AES-GCM. |
| FR-AUTH-7 | Password reset flow: user requests a reset code; user submits code + new password; all refresh tokens for that user are revoked |
| FR-AUTH-8 | Logout revokes the active refresh token; the JWT is allowed to expire naturally |

### 3.2 Team management (ENTERPRISE admins)

| ID | Requirement |
|---|---|
| FR-TEAM-1 | Admin can issue email-based invites. Token returned exactly once at creation; stored bcrypt-hashed |
| FR-TEAM-2 | Invite carries pre-assigned `allowedLevels`. Invitee inherits those levels on accept |
| FR-TEAM-3 | Public preview endpoint shows invitee which org + role + levels they're about to join, before they commit a password |
| FR-TEAM-4 | Admin can update any non-admin member's `allowedLevels` at any time. UI changes take effect on the employee's next refresh |
| FR-TEAM-5 | Admin can revoke pending invites and remove members (soft delete + revoke refresh tokens). Cannot remove the last admin |
| FR-TEAM-6 | Admin team list shows per-member progress: answered count, total, status, individual score |

### 3.3 KPI catalogue & assessment

| ID | Requirement |
|---|---|
| FR-KPI-1 | The KPI catalogue is data, 46 KPIs across PEOPLE / PROCESS / COMPANY levels, seeded from the source Excel spreadsheet |
| FR-KPI-2 | Each KPI has 4 scoring tiers with a condition rule, score value, and order. Conditions support `>=`, `>`, `==` against numeric or string values |
| FR-KPI-3 | KPIs are tagged with `frameworkCode`, `nistControlIds[]`, and `isoControlIds[]` so the catalogue can be filtered by the org's chosen framework |
| FR-KPI-4 | The list endpoint filters results to the caller's `effectiveAllowedLevels`, employees never see KPIs for levels they're not assigned |
| FR-KPI-5 | The submit endpoint scores the input against the KPI's tiers, persists a per-(org, kpi, user) response, and enqueues a snapshot rebuild (debounced) |
| FR-KPI-6 | The submit endpoint returns 403 if the KPI's level is outside the caller's allowed levels |
| FR-KPI-7 | Users can mark a KPI as Not Applicable with a justification; N/A responses are excluded from both numerator and denominator at score time |
| FR-KPI-8 | Per-user resume index: when a user reopens the app, the assessment screen lands them on the next unanswered KPI in their last-active level |
| FR-KPI-9 | Submissions accept an `idempotencyKey` (UUID), replaying the same request returns the existing row, safe for offline retry |

### 3.4 Scorecard & analytics

| ID | Requirement |
|---|---|
| FR-SCORE-1 | Live scorecard computes peopleScore, processScore, companyScore, overallScore, completeness, and per-level breakdowns on demand |
| FR-SCORE-2 | Score bands: RED < 50, AMBER 50 to 79, GREEN ≥ 80 |
| FR-SCORE-3 | Underperforming KPIs (RED/AMBER) are joined to `kpi_suggestions` rows so the API can return personalised remediation advice with the scorecard |
| FR-SCORE-4 | For ENTERPRISE non-admin users, the scorecard is scoped to their own responses + only their allowed levels (Decision A, personal completion view) |
| FR-SCORE-5 | ENTERPRISE admins see the company-level rollup: ORG-scope KPIs use admin's response as authoritative, EMPLOYEE-scope KPIs average across employees |
| FR-SCORE-6 | A snapshot worker writes `scorecard_snapshots` on submission (debounced per org), on a scheduled cron, and on admin-triggered rebuilds |
| FR-SCORE-7 | The history endpoint returns the snapshot timeline for trend charts |
| FR-SCORE-8 | Admins can generate share tokens for read-only public scorecard views. Tokens are bcrypt-hashed, time-limited, and view counts are tracked |

### 3.5 Evidence

| ID | Requirement |
|---|---|
| FR-EV-1 | Users can attach files (PDFs, screenshots, policy docs) to their KPI responses as evidence |
| FR-EV-2 | Uploads use S3/R2 presigned URLs, the API never proxies bytes |
| FR-EV-3 | Evidence metadata (fileName, fileKey, size, type) is stored in `evidence_attachments` and linked to the response |

### 3.6 AI advisor

| ID | Requirement |
|---|---|
| FR-AI-1 | One-shot scorecard comparison endpoint: AI compares the user's score to industry benchmarks and returns 3 prioritised actions + ≤5 risk flags |
| FR-AI-2 | Conversational chat endpoint: streams responses word-by-word via Server-Sent Events |
| FR-AI-3 | Chat threads are persisted per-(org, user). Users can have multiple threads, rename, and delete (soft) them |
| FR-AI-4 | Chat history is replayed on every turn so a long conversation feels coherent, but capped at the last 40 turns to keep prompts bounded |
| FR-AI-5 | System prompt includes the user's live scorecard JSON, wrapped with `cache_control: ephemeral` so follow-up turns within 5 minutes hit Anthropic's prompt cache |
| FR-AI-6 | User input is wrapped in `<user_content>` tags and the model is instructed to treat that content as untrusted data, not instructions (prompt injection mitigation) |
| FR-AI-7 | The API records token usage per call to `ai_usage` |
| FR-AI-8 | When daily spend exceeds `ANTHROPIC_DAILY_BUDGET_USD`, the API auto-falls-back from Sonnet 4.6 to Haiku 4.5. Once both budgets are exhausted, the API returns `AI_BUDGET_EXHAUSTED`. |
| FR-AI-10 | The chat endpoint defaults to a local rule-based advisor (`USE_LOCAL_ADVISOR=true`) that runs entirely inside the API process. Zero external API calls, zero cost. Replies are still streamed word-by-word over Server-Sent Events so the mobile UI behaves identically. The advisor reads the user's actual scorecard plus a hand-curated sector knowledge primer for eight industries (Banking, Healthcare, Technology, Manufacturing, Retail, Education, Government, Other). Flipping `USE_LOCAL_ADVISOR=false` switches to Anthropic Claude without any code or mobile change. |
| FR-AI-9 | Per-org daily call cap (`AI_FREE_DAILY_CALLS`) protects against runaway spend by a single tenant |

### 3.7 Notifications

| ID | Requirement |
|---|---|
| FR-NOTIF-1 | The mobile app registers an Expo push token on first sign-in; tokens are deactivated on `DeviceNotRegistered`/`InvalidCredentials` |
| FR-NOTIF-2 | Push delivery falls back to in-app `notifications` table rows if push fails (OS-level suppression, no internet, etc.) |
| FR-NOTIF-3 | An abandonment worker sends re-engagement pushes at 24h / 72h / 7d windows if an assessment is stalled |

### 3.8 Audit

| ID | Requirement |
|---|---|
| FR-AUDIT-1 | All security-relevant actions write to an append-only `audit_logs` table (login, logout, register, OTP, password change, KPI submit, KPI N/A, evidence upload, share create/revoke, AI compare, KPI CRUD, team invite/remove, team levels changed, admin impersonate) |
| FR-AUDIT-2 | Each row stores actor, org, IP, user-agent, before/after JSON, trace ID |
| FR-AUDIT-3 | Admin endpoint to query audit logs with filters |

## 4. Non-functional requirements

### 4.1 Security

| ID | Requirement |
|---|---|
| NFR-SEC-1 | Passwords hashed with Argon2id (memoryCost 19MiB, timeCost 2, parallelism 1), OWASP recommended for new applications |
| NFR-SEC-2 | All short tokens (refresh, invite, OTP) stored bcrypt-hashed at rest |
| NFR-SEC-3 | Tenant isolation enforced at the database layer via PostgreSQL Row-Level Security keyed on `app.current_org_id` |
| NFR-SEC-4 | JWT secrets and refresh-token secrets ≥32 characters, validated at boot |
| NFR-SEC-5 | TOTP secrets encrypted at rest with AES-GCM |
| NFR-SEC-6 | Rate limiting: login 5/15min/IP, password reset 5/hour/IP, accept-invite 20/15min/IP, invite create 60/hour/org, AI compare per-org daily |
| NFR-SEC-7 | HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy headers on every `/api/*` response |
| NFR-SEC-8 | No secrets in the repository. `.env` is gitignored; `.env.example` documents required variables |
| NFR-SEC-9 | Prompt injection mitigation: user input wrapped in `<user_content>` tags + system prompt instruction + closing-tag sanitisation |

### 4.2 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-1 | `/health` and `/ready` respond within 500ms under nominal load |
| NFR-PERF-2 | KPI list cached in Redis for 5min, keyed on `(level, framework)`, < 50ms typical response |
| NFR-PERF-3 | Single-KPI submit (auth + score + persist + enqueue) target < 200ms p95 |
| NFR-PERF-4 | Live scorecard for a fully-answered org (~46 responses) computes in < 100ms |
| NFR-PERF-5 | AI chat first-token latency target < 2s (depends on Anthropic; cache hits help) |
| NFR-PERF-6 | Mobile app cold start to dashboard < 3s on a mid-range device (Pixel 4a / iPhone 11) |

### 4.3 Scalability

| ID | Requirement |
|---|---|
| NFR-SCALE-1 | The schema scales to 10K orgs and 100K users without restructuring. RLS overhead is constant per query |
| NFR-SCALE-2 | Snapshot worker concurrency is configurable (default 3); each org's snapshots are serialised via deterministic jobId |
| NFR-SCALE-3 | The API process is stateless, horizontal scale by adding pods behind a load balancer |
| NFR-SCALE-4 | Workers are independent processes, scale by adding worker pods independently of API pods |

### 4.4 Reliability

| ID | Requirement |
|---|---|
| NFR-REL-1 | BullMQ retries failed jobs 5× with exponential backoff (starting 5s, max 2s per attempt). Failed jobs retained 7 days for inspection |
| NFR-REL-2 | The `/health` endpoint returns 503 when Postgres or Redis is unreachable, signalling load balancers to drain traffic |
| NFR-REL-3 | The `/ready` endpoint has a 500ms deadline, pods that haven't finished warming connection pools stay out of rotation |
| NFR-REL-4 | Audit log writes are fire-and-forget, an audit failure cannot break the user-facing request |

### 4.5 Usability

| ID | Requirement |
|---|---|
| NFR-UX-1 | Onboarding (register → OTP → first KPI answered) achievable in < 2 minutes |
| NFR-UX-2 | Assessment uses single-question screens with progress saved automatically, user can quit any time and resume on the last unanswered KPI |
| NFR-UX-3 | Streaming AI chat shows text appearing word-by-word with a cursor for feedback |
| NFR-UX-4 | Empty states never dead-end, every empty screen has either a primary action button or an explanation of what the user needs to do |
| NFR-UX-5 | Glassmorphism design language (BlurView cards, white/opacity borders, brand blue accents) consistent across all screens |
| NFR-UX-6 | Accessible colour contrast (WCAG AA) on score bands and primary UI text |

### 4.6 Maintainability

| ID | Requirement |
|---|---|
| NFR-MAINT-1 | Strict TypeScript across the entire codebase. `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noUncheckedIndexedAccess` all on |
| NFR-MAINT-2 | Single source of truth for request/response shapes via Zod schemas in `@cymetric/types`. Mobile and API import the same definitions |
| NFR-MAINT-3 | RFC 7807 Problem Details for every error response; consistent error codes in `ErrorCodes` enum |
| NFR-MAINT-4 | Append-only migration history. Never edit a past migration, always create a new one |

## 5. Software requirements

### 5.1 Languages

| | |
|---|---|
| Server | TypeScript 5.7+ on Node.js 20+ |
| Mobile | TypeScript 5.7+ (React Native 0.76.9, Expo SDK 52) |
| Seed scripts | Python 3.10+ (for `extract-kpis.py` which reads the source Excel) |
| Database | PostgreSQL 16+ |

### 5.2 Frameworks & key libraries

**Server**
- Next.js 15.1 (App Router, route handlers)
- Prisma 6.19 (ORM)
- BullMQ 5.34 (job queue on Redis)
- Anthropic SDK (Claude API client)
- Zod 3.24 (validation)
- argon2 (password hashing)
- bcrypt (short-token hashing)
- jsonwebtoken (JWT signing)
- nodemailer (SMTP)
- @aws-sdk/client-s3 + s3-request-presigner (R2/S3 uploads)
- pino + pino-http (structured logging)
- Sentry SDK (error tracking)

**Mobile**
- Expo SDK 52, expo-router v4
- React Native 0.76.9 (Bridgeless/new arch **off**)
- @tanstack/react-query 5 (server cache)
- zustand 5 (auth store)
- nativewind 4 (Tailwind for RN)
- expo-secure-store (Keychain/Keystore)
- react-native-sse (SSE consumer)
- react-native-svg (charts)
- expo-blur, expo-linear-gradient (visual)

**Shared**
- Zod (in both)
- TypeScript

### 5.3 Tools

| | |
|---|---|
| Package manager | npm 10.9+ (workspaces) |
| Build orchestration | Turbo 2.3 |
| Linting | ESLint 9 (Next config for API, Expo config for mobile) |
| Formatting | Prettier 3.4 |
| Mobile build/distribution | EAS Build + EAS Submit + EAS Update (OTA) |
| Database GUI | Prisma Studio (`npx prisma studio`) |
| API testing | curl, or any REST client (Bruno/Insomnia/Postman) |

### 5.4 External services required for full functionality

| Service | Required for | Dev fallback |
|---|---|---|
| **Anthropic API** | AI compare + chat | None, these features fail without a real key. Get one at console.anthropic.com |
| **PostgreSQL** | Everything | Local Postgres via Homebrew, Docker, or Postgres.app |
| **Redis** | Queues, rate limits, KPI cache | Local Redis via Homebrew or Docker |
| **SMTP** | OTP delivery, invites, scorecard PDFs | Dev mode returns OTPs inline in API responses, no email needed for testing |
| **S3 / R2** | Evidence uploads | Feature degrades, uploads fail but the rest of the app works |
| **Expo Push** | Mobile push notifications | Falls back to in-app `notifications` table rows |
| **HIBP** | Password breach check | None, used at registration; if HIBP is down the call fails open (registration proceeds) |
| **Sentry** | Error tracking | Optional |