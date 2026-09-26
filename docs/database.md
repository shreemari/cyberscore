# Database Documentation

PostgreSQL 16 schema managed by Prisma 6.

## Quick facts

| | |
|---|---|
| Engine | PostgreSQL 16 |
| ORM | Prisma 6.19 |
| Schema source | [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma) |
| Migrations | [apps/api/prisma/migrations/](../apps/api/prisma/migrations/) |
| Tables | 24 |
| Tenancy | Row-Level Security via PostgreSQL session variable `app.current_org_id` |
| Soft deletes | Every mutable table has `deletedAt DateTime?` |
| Primary keys | cuid2 (`@default(cuid())`) |
| Append-only | `audit_logs` (no UPDATE/DELETE), `kpi_versions`, `chat_messages` |

## Setup

```bash
# 1. Start Postgres (local, adjust if you use Docker / Supabase)
brew services start postgresql@16

# 2. Create the database
createdb cymetric

# 3. Apply migrations
cd apps/api
npx prisma migrate deploy   # or: migrate dev  (interactive in dev)

# 4. Seed (idempotent, safe to re-run)
npm run db:seed
```

The seed populates the **KPI catalogue** (46 KPIs across People/Process/Company), 212 scoring tiers, and 92 RED/AMBER suggestions, all extracted from `/Users/<...>/Desktop/KPI Scorecard/SCORE CARD_KPI_CYBER SEC_PPT_V0.9.xlsx` by `apps/api/prisma/seed/extract-kpis.py`.

## Connecting

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cymetric?schema=public
DIRECT_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cymetric?schema=public
```

`DATABASE_URL` is what Prisma reads at runtime. `DIRECT_DATABASE_URL` is used for migrations. In production we point at Neon's pooled connection for `DATABASE_URL` and the direct connection for `DIRECT_DATABASE_URL`. In local development both can be the same localhost URL.

To inspect data visually: `cd apps/api && npx prisma studio` opens a browser at `localhost:5555`.

## Tables overview

Grouped by concern. See [schema.prisma](../apps/api/prisma/schema.prisma) for the authoritative definitions.

### Identity & access (5)

| Table | What it holds |
|---|---|
| `organisations` | Org accounts. `mode = SOLO \| ENTERPRISE`. ENTERPRISE orgs have `emailDomain`, `joinMode`, `frameworkLocked`. |
| `users` | Org members. `role = EMPLOYEE \| MANAGER \| ADMIN`. `allowedLevels Level[]` gates per-user assessment access. TOTP secret encrypted at rest (AES-GCM). |
| `invites` | Email-based invites issued by admins. Token stored bcrypt-hashed. Carries pre-assigned `allowedLevels`. |
| `refresh_tokens` | Stateless JWTs + opaque refresh tokens. Refresh tokens bcrypt-hashed; revoked on logout / password change. |
| `otp_verifications` | 6-digit OTPs for registration + password reset. bcrypt-hashed. Max 5 attempts. |

### KPIs & scoring (5)

| Table | What it holds |
|---|---|
| `kpis` | The 46-KPI catalogue. Each row has `level` (People/Process/Company), `weightage`, `frameworkCode`, `nistControlIds[]`, `isoControlIds[]`, `answerScope = ORG \| EMPLOYEE`. |
| `kpi_versions` | Immutable snapshots whenever an admin edits a published KPI. Audit + reproducibility. |
| `scoring_tiers` | The 4 tier options per KPI (212 rows total). Stores the comparison rule as JSON `{op, value}`. |
| `kpi_suggestions` | 92 RED/AMBER suggestions seeded from the source spreadsheet. Joined to underperforming KPIs at scorecard time. |
| `responses` | Per-user answers. Unique `(orgId, kpiId, submittedById)`, every team member can answer independently. |

### Org state (3)

| Table | What it holds |
|---|---|
| `scorecard_snapshots` | Trend history. Written by the snapshot worker hourly + on submission (debounced). |
| `assessment_progress` | Per-user resume index per level, what KPI to land on when you reopen the app. |
| `evidence_attachments` | File metadata for uploaded evidence. Files themselves live in S3/R2. |

### Communications & sharing (4)

| Table | What it holds |
|---|---|
| `notifications` | In-app inbox rows. Created by the push worker as a fallback when Expo push fails. |
| `push_tokens` | Expo push tokens per device. Auto-deactivated on `DeviceNotRegistered`. |
| `share_tokens` | Shareable public scorecard URLs. Token bcrypt-hashed; view count tracked. |
| `chat_threads`, `chat_messages` | AI advisor conversations. Threads scoped to (org, user). Messages store token usage for analytics. |

### Admin & ops (4)

| Table | What it holds |
|---|---|
| `audit_logs` | Append-only, login attempts, KPI edits, team changes, password resets, AI calls. Holds before/after JSON for diffs. |
| `industry_benchmarks` | Per-(kpi, industry) average + top-percentile scores. Compared against in the AI advisor. |
| `api_keys` | Programmatic API access (future feature). bcrypt-hashed, prefix shown in UI. |
| `webhooks` | Outbound event sinks (future). HMAC-signed. |

### Billing & AI (2)

| Table | What it holds |
|---|---|
| `subscriptions` | Stripe plumbing, customer, subscription id, period end, cancel-at-period-end. |
| `ai_usage` | Daily Anthropic spend per (org, day, model). Drives the budget guard that falls back from Sonnet → Haiku. |

## ER diagram

A simplified view, only the foreign-key relationships, omitting timestamps and most scalar fields. Full schema at [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma).

```mermaid
erDiagram
    Organisation ||--o{ User : "has"
    Organisation ||--o{ Invite : "issues"
    Organisation ||--o{ Response : "owns"
    Organisation ||--o{ ScorecardSnapshot : "has"
    Organisation ||--o{ EvidenceAttachment : "owns"
    Organisation ||--o{ AssessmentProgress : "tracks"
    Organisation ||--o| Subscription : "has"
    Organisation ||--o{ ApiKey : "issues"
    Organisation ||--o{ Webhook : "configures"
    Organisation ||--o{ Notification : "receives"
    Organisation ||--o{ PushToken : "registers"
    Organisation ||--o{ ShareToken : "issues"
    Organisation ||--o{ AiUsage : "spends"
    Organisation ||--o{ AuditLog : "records"
    Organisation ||--o{ ChatThread : "owns"

    User ||--o{ RefreshToken : "holds"
    User ||--o{ Response : "submits"
    User ||--o{ EvidenceAttachment : "uploads"
    User ||--o{ KpiVersion : "edits"
    User ||--o{ PushToken : "registers"
    User ||--o{ AssessmentProgress : "owns"
    User ||--o{ ChatThread : "owns"

    Kpi ||--o{ ScoringTier : "tiers"
    Kpi ||--o{ Response : "answered_by"
    Kpi ||--o{ KpiVersion : "history"
    Kpi ||--o{ KpiSuggestion : "suggestions"
    Kpi ||--o{ IndustryBenchmark : "benchmarks"

    Response }o--o{ EvidenceAttachment : "attaches"

    ChatThread ||--o{ ChatMessage : "messages"

    Invite }o--|| User : "invited_by"
    Invite }o--|| User : "accepted_by"
```

## Row-Level Security (RLS)

Tenant isolation is enforced at the database layer, not the application layer. Every request flows through one of two prisma helpers in `apps/api/src/lib/prisma.ts`:

| Helper | Sets | Use when |
|---|---|---|
| `withTenant(orgId, fn)` | `app.current_org_id = orgId` | Normal request handlers. RLS policies filter every query to that org. |
| `withBypassRls(fn)` | Skips RLS | System operations: workers, seed, registration (before the org exists), the JWT verifier looking up users by token. |

This means a bug in application code (e.g. forgetting a `where: { orgId }` clause) cannot leak another tenant's data, the database rejects the query.

## Migrations

Each migration in `apps/api/prisma/migrations/` has a `migration.sql` that's applied verbatim. Order:

1. `20260423115340_init`. Initial 21-table schema.
2. `20260429000000_enterprise_mode`. Added `OrgMode`, `JoinMode`, `AnswerScope`, invites, enterprise fields on `organisations`.
3. `20260429000001_per_user_progress`. Moved `assessment_progress` from org-keyed to (org, user)-keyed.
4. `20260506080246_add_allowed_levels`. Added `User.allowedLevels` and `Invite.allowedLevels` for per-user assessment gating.
5. `20260516074342_add_chat_threads`. Added `chat_threads` and `chat_messages` for the AI advisor.
6. `20260516123040_add_response_matched_tier_relation`. Added a proper Prisma relation from `Response` to `ScoringTier` so the admin team scorecard can show tier-distribution views. Includes a data cleanup step that NULL-s out orphaned `matchedTierId` rows from earlier reseeds before adding the foreign key.
7. `20260516123100_rls_policies`. Enables FORCE Row-Level Security on the 19 tenant-scoped tables. Adds helper functions `current_org_id()` and `rls_bypass()` so policies are uniform across tables. Honours `app.bypass_rls = 'on'` so worker, registration, and login flows can still operate cross-tenant. KPI catalogue tables (`kpis`, `scoring_tiers`, `kpi_versions`, `kpi_suggestions`, `industry_benchmarks`) are deliberately not under RLS because they are shared across all tenants.

To create a new migration:

```bash
cd apps/api
# Edit schema.prisma first, then:
npx prisma migrate dev --name what_changed
```

In production:
```bash
npx prisma migrate deploy   # non-interactive, no schema drift detection
```

## Indexes

All hot-path lookups are indexed. Notable choices:

- `users (orgId, role)`. Fast admin queries for "all employees of this org"
- `responses (orgId, kpiId, submittedById)` unique, multi-user safety
- `responses (orgId, idempotencyKey)` unique, offline-retry safety
- `audit_logs (orgId, createdAt DESC)`. Review UI loads newest-first
- `chat_threads (orgId, userId, updatedAt DESC)`. Thread list ordering
- `ai_usage (orgId, day, model)` unique, daily aggregation upsert

## Sample data (demo account)

The demo user lives in the production Neon database and is also planted by `npm run db:seed` into any local development database that imports the same seed.

| | |
|---|---|
| Email | `saanvi.vishal@iiitb.ac.in` |
| Password | `cyberscore-demo-2026` |
| Org | IIIT Bangalore, ENTERPRISE mode, Banking industry, EXCEL framework |
| Role | ADMIN with all three allowed levels (PEOPLE, PROCESS, COMPANY) |
| State | All 46 KPIs already answered, so the dashboard shows a populated scorecard |

To re-plant or reset this user against any database (including the production Neon URL), run:

```bash
cd apps/api
DATABASE_URL='postgresql://...' npx tsx scripts/seed-demo-user.ts
```

The script is idempotent. It reads `DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_ORG_NAME`, `DEMO_INDUSTRY`, and `DEMO_NAME` from environment variables if you want to plant a different user, otherwise it uses the defaults shown above.

To create a fresh enterprise admin for testing the team flow end to end, see the manual test plan at [docs/testing-manual.md](testing-manual.md). The full curl-based walkthrough is in section E of [docs/known-issues.md](known-issues.md).