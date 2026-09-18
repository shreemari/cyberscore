# Roadmap

Where this project goes after the current handover. Items are tagged with rough effort (S = ≤1 day, M = 2 to 5 days, L = 1 to 2 weeks).

## Highest priority, production readiness

These block a real production launch.

| Item | Effort | Why |
|---|---|---|
| Write a basic test suite | L | Zero tests today. Target sixty percent coverage on `lib/scoring.ts`, `lib/scorecard.ts`, `lib/access.ts`, `lib/auth.ts` first. The supervisor's number-one ask. |
| Set up CI on GitHub Actions | S | Lint, typecheck, and test on every pull request. Automated `prisma migrate deploy` against a staging Neon branch on merge to `main`. Template in [deployment.md](deployment.md). |
| Wire Sentry for error tracking | S | The `SENTRY_DSN` env var is already read by `apps/api/instrumentation.ts`. Sign up for a free Sentry account, paste the DSN into Vercel, redeploy. Errors then show up grouped with stack traces. |
| Set up a staging Neon branch | S | One free Neon project can have multiple branches. Run migrations against the staging branch first, then promote. Today everything goes straight to production. |
| Wire R2 / S3 for evidence uploads | S | The schema, the presigned URL endpoint, and the confirm endpoint all exist. Needs real credentials in `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_ENDPOINT` plus a CORS policy on the bucket. |
| Map remaining Anthropic errors to friendly UI text | S | The mobile chat now defaults to the local advisor so this is rare, but if a future batch flips `USE_LOCAL_ADVISOR=false` and hits a quota error, the raw `Your credit balance is too low` should not surface to the user. |
| Verify all RLS policies under realistic multi-tenant load | M | The policies are committed (v0.2.0) and applied (v0.3.0). What is missing is a stress test where two tenants hit overlapping endpoints concurrently to confirm Postgres returns nothing for the wrong tenant. |

Items that used to be on this list and are now done:

- *Apply RLS policies to all tenant tables.* Done in v0.2.0, migration `20260516123100_rls_policies` enables FORCE RLS on all 19 tenant-scoped tables.
- *Fix the four pre-existing TypeScript errors.* Done in v0.2.0 via the `title` getter on `ApiError` and the proper `matchedTier` relation.
- *Wire real SMTP credentials.* Done in v0.3.0 through Brevo's HTTP API (300 emails per day free). Auto-detected in `lib/email.ts`.
- *Generate `EXPO_PUBLIC_API_URL` from EAS secrets.* Done in v0.3.0 in `apps/mobile/eas.json` (both the `preview` and `production` profiles bake the live Vercel URL).
- *Add per-minute rate limit to AI chat.* Done in v0.2.0 (20 messages per minute per user via Redis sliding window).

## Near-term features

What a small follow-on batch could realistically ship.

### F1. Push notifications wired end-to-end (M)

The `push_tokens` table, the worker, and the Expo SDK plumbing all exist. What's missing:
- An admin trigger to send a custom push to a team
- Scheduled engagement pushes ("Your weekly score is in")
- A `/notifications` screen in the mobile app to show the in-app inbox (`notifications` table)

### F2. Scorecard PDF export (M)

The email worker handles a `SCORECARD_PDF` job type that's defined in `lib/queue.ts` but not wired up. Needs:
- A `lib/pdf.ts` that renders the scorecard via `pdfkit` or `puppeteer`
- A POST endpoint that enqueues the job
- A "Email me a PDF" button on the scorecard screen

### F3. Multi-framework view toggle (S)

The KPI catalogue is already tagged with NIST and ISO control IDs. The mobile UI shows scores under the org's *selected* framework only, adding a toggle to view the same data through a different framework's lens is mostly UI work.

### F4. Industry benchmarks in the dashboard (M)

The `industry_benchmarks` table exists and the seed populates a few rows. Surface them on the scorecard:
- "Your score: 62. Industry average: 71. Top quartile: 85."
- Wire into the AI chat system prompt so the advisor can reference real benchmarks

### F5. Onboarding improvements (S)

- Show progress meter during the first-assessment flow ("KPI 7 of 46")
- "Skip for now" option on the first OTP (deferred verification), currently mandatory
- Better welcome screen explaining the People/Process/Company taxonomy

### F6. Streaming thinking display (S)

The chat currently uses `thinking: {type: 'disabled'}` for snappy first-token latency. Toggling on adaptive thinking + display: 'summarized' (Anthropic SDK feature) would give richer reasoning for harder questions like "where do I start." Tradeoff: 2-3s pause before any text appears.

### F7. Better team analytics (M)

The admin dashboard shows per-member completion + score. Missing:
- Per-KPI consensus signals (where do employees disagree with admin?), the data is there via `rollupResponses`, just needs UI
- Drill-down: tap an employee to see their per-level breakdown
- Export team scorecard as CSV

## Mid-term

Strategic items, batch+1 territory.

### M1. SSO (L)

OIDC + SAML integration. Most ENTERPRISE customers will demand this. Auth0 / WorkOS would be the fastest path; rolling it ourselves with `passport-saml` is doable but high-maintenance.

### M2. Per-employee snapshot history (M)

Currently snapshots are org-level only. Adding per-(org, user) snapshots would unlock individual trend charts and "you've improved by 12% this month" nudges. Schema change: add `userId String?` to `scorecard_snapshots`, write personal snapshots from the worker for non-admins.

### M3. Continuous re-assessment (L)

KPIs decay, MFA coverage drifts when new employees join without onboarding. Periodically re-prompt users to confirm their answers ("Is this still accurate?"). Schema: add `assessedAt` per response, define a per-KPI staleness window in `kpis.reassessIntervalDays`.

### M4. Compliance report templates (L)

Generate filled SOC 2 / ISO 27001 / NIST CSF compliance checklists from the scorecard. The control-ID mapping is already in place, this is mostly rendering work.

### M5. Webhooks (M)

The `webhooks` table exists but is unwired. Customers want events like `scorecard.recomputed`, `kpi.submitted`, `member.removed` pushed to their Slack / Discord / Splunk. The worker side is straightforward; the security side (HMAC signing, replay protection) needs care.

### M6. API keys for programmatic access (M)

Same, `api_keys` table exists, no auth middleware reads from it. Add a `requireApiKey` helper next to `requireAuth` that hits a bcrypt verify path.

### M7. Web dashboard (L)

A read-only web view (Next.js can do this in the same monorepo) so users can pull up their scorecard at a desk without launching the phone. The SDK is already platform-agnostic, just needs a new `apps/web` consuming it.

### M8. Multi-region / data residency (L)

EU customers will eventually demand EU-hosted data. The app is region-agnostic; the work is mainly DevOps: deploy a second Vercel + Neon pair in an EU region (Neon supports `eu-central-1` and others), add a `region` column to organisations, and route each org's traffic to the right pair. Today everything lives in Singapore.

## Far-term / blue sky

Optimisation and breadth, not on the critical path.

| Item | Effort |
|---|---|
| Mobile dark/light theme toggle (currently dark-only) | S |
| Localisation (i18n), start with English/Hindi/Spanish | M |
| Anomaly detection, flag suspicious response patterns (an employee answering 46 KPIs in 10 seconds) | M |
| AI agent that drafts policies based on KPI gaps | M |
| Public benchmarking, opt-in anonymous scorecard sharing across customers, "you score in the 73rd percentile of Tech companies" | L |
| White-labelled product for MSPs | L |
| Audit log export to S3 (compliance) | S |

## Things we deliberately decided NOT to do

For the next batch's awareness, these came up and were rejected with reasoning:

- **Microservices**: the modular monolith handles the projected scale fine. Splitting it would only add ops complexity. Reconsider at >50K active users.
- **GraphQL**. REST + Zod schemas give us 90% of the type safety with 10% of the tooling complexity. Maybe at scale, not now.
- **A separate admin web app**: the admin features live in the mobile app and are gated by role. One app to maintain. If admins start demanding desktop-only features (CSV exports, bulk operations), revisit.
- **OAuth via Google/Apple at registration**: adds a UX corner case (Google account → org email mismatch) that complicates the ENTERPRISE_ADMIN domain-keying logic. Defer until SSO comes in M1.
- **Server-side rendering for any scorecard view**. Next.js App Router supports it but the API serves mobile primarily. No SEO concern. Keep it API-only.