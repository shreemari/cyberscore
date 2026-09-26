# Handover Checklist

This document maps the 20 sections maps to the actual state of the CyMetric project. Every section gives a one-word status, a short summary of what was done in that area, and a link to the deeper documentation file when there is one.

**Status words used in this document:**
- Done: shipped and verified.
- Partial: started, has some gaps that the next batch needs to close.
- Not started: nothing built for this item yet.
- Deferred: deliberately skipped with a reason given.


**Live URL:** https://cyberscore-api.vercel.app

---

## Snapshot at handover

CyMetric is fully deployed end to end. The mobile APK runs standalone on Android and talks to the live API hosted on Vercel (Singapore region). The database is on Neon Postgres (Singapore). The cache and rate-limit store is on Upstash Redis (Singapore). Password reset, signup verification, and team invitation emails all arrive in real inboxes through Brevo's HTTP email API. A free `cron-job.org` job pings `/api/v1/keepwarm` every two minutes to keep the Vercel functions and the Neon database warm.

For the supervisor:

- Live API: https://cyberscore-api.vercel.app (health: `/api/v1/health`)
- Demo user: `saanvi.vishal@iiitb.ac.in` and `cyberscore-demo-2026`. Verified ENTERPRISE admin, IIIT Bangalore organisation, Banking industry. The user has answered all three assessment levels, so the dashboard shows real data and the MANAGE banner is visible.
- Mobile APK download: see Access and Credentials section below for the EAS build artifact link.
- GitHub repository: https://github.com/saanvivishal/cyberscore
- Demo video: hosted on IIIT Bangalore SharePoint, recorded 2026-05-18, around four to five minutes long. Link in the README plus the Demo section below.

What was built over five weeks: an authenticated mobile-first SaaS that lets a company (or an individual) self-assess their cybersecurity health across 46 KPIs grouped under People, Process, and Company. It gives them a live numeric scorecard mapped to NIST CSF 2.0 and ISO 27001, a trend chart from historical snapshots, personalised remediation suggestions per weak KPI, an AI advisor chat grounded in the user's actual answers, an enterprise team admin path with per-employee level permissions, password reset by email OTP, optional two-factor authentication, shareable read-only scorecard URLs, and a full audit log for every security-relevant action.

---

## 0. Project Overview

Status: Done.

The project is a mobile-first SaaS named CyMetric. It lets an organisation self-assess its cybersecurity posture across 46 KPIs grouped under three levels (People, Process, Company), get a live numeric scorecard mapped to NIST CSF 2.0 and ISO 27001 control families, and receive personalised remediation advice from a built-in AI advisor. There are two operating modes. SOLO is for an individual user (a founder, an IT lead) doing a self-assessment alone. ENTERPRISE is for a company admin who invites employees by email and assigns each one a subset of the three assessment levels.

| Field | Value |
|---|---|
| Project title | CyMetric: Cybersecurity Health Scorecard SaaS |
| Team members | Saanvi Vishal (IIIT Bangalore, IMT2021043). Sole developer this batch. |
| Mentor | Mohan Ram C, FISST (Foundation for Innovation in Security and Software Technology) |
| Project duration | 2026-04-15 to 2026-05-19 (about five weeks) |
| Repository link | https://github.com/saanvivishal/cyberscore |
| Demo date | 2026-05-18 |

---

## 1. README

Status: Done.

The repository's README covers everything a first-time reader needs: a one-paragraph project overview, the architecture diagram in plain Mermaid, the install path for end users (Android APK download via the EAS link), the install path for developers (clone, setup script, three terminal tabs), a tech stack table with the reason for each choice, a features list split by user type (solo, enterprise, developer), a common-issues table that documents the symptoms we hit during the build, the full environment variables reference, the npm script list, and the license footer.

| Item | Status | Where |
|---|---|---|
| Project overview | Done | `README.md`, "What is this" section |
| Features list | Done | `README.md`, "What the app actually does" section |
| Tech stack | Done | `README.md`, "Tech stack" table |
| Setup instructions for the deployed app | Done | `README.md`, "Quick start (try the app)" section |
| Setup instructions for local development | Done | `README.md`, "Run the project locally" section |
| Demo link | Done | `README.md` header, plus link in the Demo section of this file |
| FAQ and common issues | Done | `README.md`, "Common issues" table, plus `docs/known-issues.md` |

---

## 2. Requirements Documentation

Status: Done.

Functional, non-functional, and software requirements are all captured in `docs/requirements.md`. There are 40 functional requirements split across eight areas (auth, KPIs, scoring, AI chat, evidence uploads, team management, notifications, share tokens). The non-functional side covers performance targets (p95 API latency, AI streaming first-token under 1.5 seconds), scalability (horizontal scaling of API and worker, Redis caching, Anthropic prompt caching), security (OWASP-recommended primitives, RLS for tenant isolation, RFC 7807 error responses, append-only audit log), and usability (accessibility targets, dev-mode helpers like the OTP autofill banner, the glassmorphism design system). The software section lists every language, framework, library, and tool used.

| Item | Status | Where |
|---|---|---|
| Functional requirements (40 items, 8 areas) | Done | `docs/requirements.md`, section 3 |
| User roles and permissions | Done | `docs/requirements.md`, section 2. SOLO user, ENTERPRISE admin, ENTERPRISE employee, each with explicit allowed-levels rules |
| Use cases and user stories | Done | The functional requirement list plus the four sequence diagrams in `docs/system-design.md` |
| Performance targets | Done | `docs/requirements.md`, section 4.2 |
| Scalability plan | Done | `docs/requirements.md`, section 4.3 |
| Security requirements | Done | `docs/requirements.md`, section 4.1 |
| Usability expectations | Done | `docs/requirements.md`, section 4.5 |
| Languages, frameworks, tools | Done | `docs/requirements.md`, section 5 |

---

## 3. System Design

Status: Done.

The system design doc breaks the work into a high-level part (HLD) and a low-level part (LLD). The HLD has a Mermaid system-context diagram showing the mobile app talking to the API, the API talking to Postgres and Redis, and the API integrating with Anthropic, Brevo, Cloudflare R2, Expo Push, and Sentry. It enumerates the major modules: auth, scorecard, AI advisor, evidence, team, snapshot worker, the SDK package, the mobile UI. The LLD goes deeper: the scoring algorithm explained step by step, the JWT and refresh-token issuance and rotation, the AI streaming pipeline including the SSE wire format, the access control rules in plain English, the snapshot worker's job lifecycle, the SDK's error mapping, the mobile AuthGate's session hydration logic. There is one class diagram (the auth module) and four full sequence diagrams (onboarding, AI chat streaming, invite plus accept invite, KPI submit plus snapshot recompute).

| Item | Status | Where |
|---|---|---|
| System overview diagram | Done | `docs/system-design.md`, "System context" |
| Major components and modules | Done | `docs/system-design.md`, "Major modules" |
| External integrations | Done | `docs/system-design.md`, "External integrations" |
| Module-level breakdown | Done | `docs/system-design.md`, "Low-Level Design" |
| Class diagram | Done | `docs/system-design.md`, auth module classDiagram block |
| Sequence diagrams | Done | Four end-to-end flows in `docs/system-design.md` |

---

## 4. Architecture

Status: Done.

The architecture doc explains the project as a modular monolith (one Next.js process, but with logically separated lib modules that do not reach into each other's internals). It includes a Mermaid flowchart showing the full request path, a "what happens during a representative request" walk-through covering tenant isolation via Row Level Security and JWT verification, a tech stack table that explains why each choice was made (and why not the obvious alternative), and a "Key design decisions" section documenting seven non-trivial choices with rationale: modular monolith over microservices, Postgres with Prisma over MongoDB, Row Level Security over application-layer tenant checks, JWT plus opaque refresh tokens over stateful sessions, Anthropic Claude with prompt caching for AI, local rule-based advisor as the default chat backend, and React Native plus Expo over native iOS plus Android.

| Item | Status | Where |
|---|---|---|
| Architecture diagram | Done | `docs/architecture.md`, modular monolith pattern with Mermaid flowchart |
| Data flow diagram | Done | `docs/architecture.md`, "Data flow" section walking through one request |
| Tech stack justification | Done | `docs/architecture.md`, "Tech stack" table |
| Key design decisions and rationale | Done | `docs/architecture.md`, seven decisions explained |

---

## 5. Codebase Readiness

Status: Done overall, with one partial item.

The repository follows a clean monorepo layout. npm workspaces and Turbo run the task graph. `apps/api` holds the Next.js 15 backend with all 54 route handlers, the Prisma schema and migrations, the BullMQ worker code (kept for non-Vercel deployments), and the demo-user seed script. `apps/mobile` holds the Expo SDK 52 app with file-based routes for the auth flow and the main app. `packages/sdk` is the typed fetch client used by mobile. `packages/types` holds the Zod schemas shared by API and mobile so request and response shapes can never drift. Every file is TypeScript, strict mode is on across all workspaces, names follow consistent conventions (camelCase for variables and functions, kebab-case for file routes, PascalCase for React components, snake_case for Postgres tables via Prisma's `@@map`), and complex functions have block comments explaining why (not what).

| Item | Status | Notes |
|---|---|---|
| Clean folder structure | Done | npm workspaces with Turbo. Full structure documented in `README.md` repository layout. |
| No unnecessary files in git | Done | `.next`, `node_modules`, `.turbo`, build artifacts, `.env`, `.DS_Store`, and the stray root `app.json` are all gitignored. Verified with `git status --ignored`. |
| Naming conventions | Done | Consistent across the codebase. |
| Comments for complex logic | Done | Block comments above scoring, RLS bypass, refresh-token rotation, SSE streaming, the local advisor's intent detection, and other non-obvious places. |
| Docstrings and inline documentation | Partial | Route handlers carry header doc blocks explaining purpose and auth posture. Many `lib/` exports rely on TypeScript signatures alone. Acceptable for an internal codebase. If the next batch publishes the SDK externally, JSDoc on public exports becomes worth doing. |

---

## 6. Dependency and Environment Setup

Status: Done.

Every workspace has its own `package.json` with pinned dependency versions and a committed `package-lock.json` so installs are reproducible. There are three `.env.example` files: one at the repo root, one in `apps/api/` for the API-specific variables, and one in `apps/mobile/` for the mobile build-time variables. Every variable has an inline comment explaining what it does. Production values live in Vercel Environment Variables, never in any file. The setup script (`scripts/setup.sh`) bootstraps a fresh clone in one command: install dependencies, copy the env file, run Prisma migrate dev, run the seed.

| Item | Status | Where |
|---|---|---|
| Dependency files present | Done | `package.json` at root and per workspace |
| Versions specified | Done | All packages on caret ranges, `package-lock.json` committed |
| `.env.example` files included | Done | Root, `apps/api/`, and `apps/mobile/` |
| Environment variables documented | Done | Inline comments in every `.env.example` plus `docs/deployment.md` for production values |
| Setup instructions verified | Done | `scripts/setup.sh` tested on fresh clones. Manual steps also in `docs/database.md` if the script fails. |

---

## 7. Database Documentation

Status: Done.

The Prisma schema at `apps/api/prisma/schema.prisma` is the single source of truth for the database. 24 tables total, roughly 150 columns, around 30 indexes. The schema is split into clear concern groups: identity (Organisation, User, RefreshToken, OtpVerification, Invite), assessment (Kpi, ScoringTier, Response, KpiSuggestion, AssessmentProgress, ScorecardSnapshot, KpiVersion, IndustryBenchmark), evidence (EvidenceAttachment), team and audit (AuditLog), notifications (Notification, PushToken), sharing (ShareToken), AI (AiUsage, ChatThread, ChatMessage), and billing-ish placeholders (Subscription, ApiKey, Webhook). Seven migrations live in `apps/api/prisma/migrations/`. The seed script populates 46 KPIs, 212 scoring tiers, and 92 personalised remediation suggestions, all extracted from the source XLSX file via a small Python script. There is also a separate `seed-demo-user.ts` that plants the demo user against any database URL.

| Item | Status | Where |
|---|---|---|
| Database schema | Done | `apps/api/prisma/schema.prisma` |
| Migration files | Done | Seven migrations in `apps/api/prisma/migrations/`: `init`, `enterprise_mode`, `per_user_progress`, `add_allowed_levels`, `add_chat_threads`, `add_response_matched_tier_relation`, `rls_policies` |
| ER diagram | Done | `docs/database.md`, Mermaid `erDiagram` covering all 24 tables |
| Sample and seed data | Done | `apps/api/prisma/seed.ts` plus `apps/api/scripts/seed-demo-user.ts` |
| Setup instructions | Done | `docs/database.md` covers local Postgres install, migrate, seed, and the Neon production path |

---

## 8. Deployment

Status: Done.

The project is fully deployed and reachable from any phone or laptop on the internet. The API runs on Vercel (Hobby tier) in the Singapore region. The database is Neon Postgres in Singapore. The cache and rate-limit store is Upstash Redis in Singapore. Email goes through Brevo's HTTP API. The Android APK is built by Expo's EAS cloud builder. A free cron-job.org job hits `/api/v1/keepwarm` every two minutes to keep Vercel's functions and Neon's compute warm. Total monthly cost is zero rupees because every service is on a free tier. `docs/deployment.md` is the full 12-step runbook from a fresh clone, with every command verified and every gotcha we hit documented.

| Item | Status | Notes |
|---|---|---|
| Deployment steps documented | Done | `docs/deployment.md` is now a real runbook, not a plan |
| Hosting platforms | Done | Vercel for API, Neon for Postgres, Upstash for Redis, Brevo for email, EAS Build for the APK, cron-job.org for keep-warm |
| Environment configs for production | Done | All env vars set in Vercel Project Settings, with sensitive ones marked. Local dev vars stay in `.env`. |
| CI/CD pipeline | Partial | Git push to `main` triggers a Vercel auto-deploy in about three minutes. No GitHub Actions workflow yet because there are no tests to run. Template provided in `docs/deployment.md` for the next batch. |
| Cold-start mitigation | Done | The cron pings `/api/v1/keepwarm` every two minutes. That endpoint warms eight dashboard lambdas and runs a cheap SELECT 1 against Postgres so Neon does not scale to zero. |
| Email delivery | Done | Brevo HTTP API. Auto-detected from the `SMTP_PASS` prefix in `apps/api/src/lib/email.ts`. Verified by real OTPs landing in real inboxes during the demo. |
| Region pinning | Done | `apps/api/vercel.json` pins Vercel functions to `sin1` so they sit in the same datacenter region as Neon and Upstash. Per-query database latency dropped from around 250 ms to under 10 ms. |

---

## 9. Testing

Status: Partial. Manual coverage is in place, automated tests are not.

There is no automated test suite. Vitest is wired up in the API workspace and `npm run test` works from the repo root, but the test directories are empty. This is the single largest gap in the project and is called out as the highest priority for the next batch. To compensate, there is a scripted manual test plan (`docs/testing-manual.md`) with a five-minute smoke test and a thirty-minute full regression covering every major flow. All of the auth, assessment, scorecard, chat, password-reset, and team-admin paths have been verified end to end against the live deployment.

| Item | Status | Notes |
|---|---|---|
| Unit tests | Not started | Vitest is wired but no tests written |
| Integration tests | Not started | Same as above |
| Manual test coverage | Done | `docs/testing-manual.md` |
| Test execution steps documented | Done | `npm run test` at root or per workspace. See `CONTRIBUTING.md` Tests section. |
| Known failing tests | Not applicable | No tests means no failing tests |

Priority test targets for the next batch, in rough order of value:

1. `lib/scoring.ts`. Pure functions, easy unit tests, high value because scoring is the product's main output.
2. `lib/scorecard.ts`. Pure aggregation logic. Mock the Prisma client and test the rollup behaviour.
3. `lib/access.ts`. Small but security-critical. Tests for `effectiveAllowedLevels` would catch any future regression in the per-employee level gate.
4. `lib/auth.ts`. Token issuance and rotation.
5. Auth route handlers as integration tests with a real Postgres test database.

---

## 10. Sprint Documentation

Status: Done.

The five weeks of work are documented sprint by sprint in `docs/sprints.md`. Each sprint section names the goal, what got built, what slipped, what worked, what did not, and an estimate of active development hours. There was no formal Scrum or Jira because the team was one person. The sprints below are retrospective groupings.

| Sprint | Window | Theme |
|---|---|---|
| Sprint 1 | Week 1 (15 to 21 Apr) | Repo bootstrap, Prisma schema, auth foundation with JWT plus refresh tokens, mobile shell with onboarding, login, register, verify-OTP screens |
| Sprint 2 | Week 2 (22 to 28 Apr) | KPI extraction from the source XLSX, scoring engine (pure functions), dashboard with score ring, assessment flow, KPI question screen, the typed SDK package |
| Sprint 3 | Week 3 (29 Apr to 5 May) | ENTERPRISE mode with invites, per-user level permissions, team admin screen with per-member completion and score, soft-delete for revoked employees, audit log for every team action |
| Sprint 4 | Week 4 (6 to 12 May) | AI chat with Anthropic streaming and prompt caching, local rule-based advisor with sector knowledge for eight industries (used as the default to avoid API costs), password reset flow, per-user chat rate limit |
| Sprint 5 | Week 5 (13 to 19 May) | Production deployment to Vercel plus Neon plus Upstash plus Brevo, Android APK via EAS, demo video recording, handover documentation, and the post-demo perf and bug fixes for v0.3.1 |

| Item | Status |
|---|---|
| Sprint goals defined | Done |
| Task breakdown per sprint | Done |
| Timeline per sprint | Done |
| Assigned responsibilities | Done. Sole developer. |
| Completed tasks per sprint | Done |
| Sprint review summary | Done |
| Sprint retrospective (what worked, what did not) | Done. End of each sprint section in `docs/sprints.md`. |

---

## 11. Roadmap and Future Work

Status: Done.

`docs/roadmap.md` lays out what the next batch should pick up. The highest priority items are the ones that block a real production launch: write automated tests, set up GitHub Actions CI, verify RLS policies under load, set up a staging Neon branch, wire Sentry for error tracking. Near-term features include push notifications end to end, scorecard PDF export, multi-framework view toggle, industry benchmarks on the scorecard, per-employee snapshot history, CSV exports. Bigger items for batch+1 include SSO, continuous re-assessment prompts, compliance report templates, webhooks, a web dashboard, multi-region deployment. There is also a "Things we deliberately decided not to do" section explaining why microservices, GraphQL, a separate admin app, and OAuth via Google or Apple were rejected in this batch.

| Item | Status | Where |
|---|---|---|
| Pending features | Done | `docs/roadmap.md`, near-term and mid-term sections |
| Suggested improvements | Done | `docs/roadmap.md`, highest priority section |
| Priority areas for next batch | Done | Start with tests, CI, Sentry. Everything else is icing. |
| What we deliberately rejected | Done | `docs/roadmap.md`, "Things we decided not to do" section |

---

## 12. Known Issues and Limitations

Status: Done.

`docs/known-issues.md` is the honest inventory of what is broken, incomplete, or operationally weak. It is grouped into bugs, incomplete features, architectural gaps, and operational concerns, with a separate section listing what was fixed in each version. Every item has either a fix-in-place note, a workaround, or a clear pointer to where to start when the next batch picks it up.

| Item | Status | Where |
|---|---|---|
| Bugs not fixed | Done | `docs/known-issues.md`, section A |
| Performance limitations | Done | `docs/known-issues.md`, section C |
| Edge cases not handled | Done | `docs/known-issues.md`, sections B and D |

What was fixed across the three released versions:

- v0.2.0: Row Level Security policies applied to 19 tenant-scoped tables. All five pre-existing TypeScript errors resolved. Local rule-based advisor replaces Anthropic for chat by default (zero API cost). Per-user chat rate limit of 20 messages per minute.
- v0.3.0: Live deployment to Vercel through five distinct failure modes. Brevo HTTP email delivery. Cold-start mitigation via cron-job.org keep-warm cron. Onboarding carousel made reachable (the `index.tsx` redirect was hardcoded to skip it). KPI question screen perf optimisation (parallelised writes, fire-and-forget invalidations, around two to three times faster click-to-next).
- v0.3.1: Vercel function region pinned to `sin1` (Singapore). New `/api/v1/keepwarm` endpoint warms eight dashboard lambdas plus the database with one HTTP call. Demo user flipped from SOLO to ENTERPRISE so the MANAGE banner shows. Login rate limit bumped from 5 to 30 attempts per IP per 15 minutes.

---

## 13. Demo and Presentation

Status: Mostly done. Final report and slides still pending.

| Item | Status | Notes |
|---|---|---|
| Final report (PDF) | Done | `docs/cyberscore-final-report.pdf`. A 24-page document containing the full project report plus a six-slide presentation outline. Generated by `docs/generate_handover_pdf.py`. |
| Presentation slides (PowerPoint) | Pending | Saanvi to assemble. The six-slide outline is inside the final report PDF, ready to copy into PowerPoint. |
| Demo video | Done | Recorded 2026-05-18, around four to five minutes. Hosted on IIIT Bangalore SharePoint: [Watch on OneDrive](https://iiitbac-my.sharepoint.com/:v:/g/personal/saanvi_vishal_iiitb_ac_in/IQA6_RpGKPsHTp2JsEX8W6dVAdQG0jaFrzJQZSFKEfj32Wk?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJPbmVEcml2ZUZvckJ1c2luZXNzIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXciLCJyZWZlcnJhbFZpZXciOiJNeUZpbGVzTGlua0NvcHkifX0&e=B6uqLC). Access is scoped to the IIITB tenant. Mohan Ram C should have view access through his FISST account. Verify before sharing externally. |
| Screenshots | Done | In `demo/screenshots/`: onboarding, dashboard, assessment, scorecard, AI chat, team admin. |

### What the demo video shows

The recording walks through the full happy path on a real Samsung phone:

1. App launch with the onboarding carousel (Security Scans, Live Scorecard, AI Insights).
2. Login with the demo credentials. The Vercel API responds, the JWT is issued, the dashboard hydrates.
3. Dashboard tour: overall score ring, the three level tiles (People, Process, Company), the MANAGE banner for ENTERPRISE admins, the last snapshot date, the resume-assessment button.
4. Assessment flow: pick the PEOPLE level, answer a few KPIs (multi-choice tier selection plus a percentage input), and watch the optimistic Next-button transition.
5. Scorecard breakdown: per-level scores, per-KPI tier match, Red, Amber, and Green bands.
6. Analytics tab: the historical snapshot timeline and the personalised suggestions per underperforming KPI.
7. AI chat: ask "where am I weakest" and the local advisor streams a Banking-sector-specific reply mentioning PCI DSS and RBI guidelines, grounded in the user's actual scorecard.
8. Profile and framework picker.
9. Password reset flow: tap Forgot, enter the email, the OTP arrives in the IIITB inbox via Brevo, enter the OTP, set a new password, log back in.

### Presentation slides outline (six slides)

Detailed slide-by-slide content is in `docs/cyberscore-final-report.pdf`, part two. The slides cover:

1. Title (project, presenter, mentor, institution, date).
2. Problem and solution (split slide).
3. Architecture and tech stack (combined slide).
4. Live demo (play the video).
5. Deployment and process (what is deployed, the five sprints).
6. Lessons learned and thanks.

---

## 14. Access and Credentials Transfer

Status: Documented. Not yet transferred.

`docs/access-credentials.md` is the in-depth version. Short version below. No secrets are written in this document. Secrets live only in Vercel Environment Variables (production) and `apps/api/.env` (local, gitignored).

### Live services

| Service | What it does | Owner | URL |
|---|---|---|---|
| GitHub | Source repository | Saanvi Vishal (`saanvivishal@gmail.com`) | https://github.com/saanvivishal/cyberscore |
| Vercel | Hosts the API | Saanvi Vishal (Hobby tier, free) | https://vercel.com/saanvivishals-projects/cymetric-api |
| Neon | Production Postgres in Singapore | Saanvi Vishal (Free tier) | https://console.neon.tech |
| Upstash | Production Redis in Singapore | Saanvi Vishal (Free tier) | https://console.upstash.com |
| Brevo | Transactional email, 300 per day on free tier | Saanvi Vishal, registered as "iiit bangalore" | https://app.brevo.com |
| Expo and EAS | Mobile app build and distribution | Expo username `saanviiiiiiiiiiiiii` | https://expo.dev/accounts/saanviiiiiiiiiiiiii |
| cron-job.org | Free keep-warm cron pinging `/api/v1/keepwarm` every two minutes | Saanvi Vishal | https://console.cron-job.org |

### Secrets that live outside this repo

Stored in `apps/api/.env` on Saanvi's laptop and in Vercel Environment Variables in production:

- `JWT_SECRET` (64+ random characters)
- `REFRESH_TOKEN_SECRET` (64+ random characters)
- `TOTP_ENCRYPTION_KEY` (exactly 64 hex characters)
- `DATABASE_URL` and `DIRECT_DATABASE_URL` (Neon connection strings)
- `REDIS_URL` (Upstash TLS connection string)
- `SMTP_PASS` (Brevo API key, format `xkeysib-...`)
- `ANTHROPIC_API_KEY` (only set when `USE_LOCAL_ADVISOR=false`, currently unused)

### Transferring access to the next batch

1. GitHub: invite the new owner as a collaborator under Settings, Collaborators, Add people. Or transfer ownership to a FISST GitHub organisation.
2. Vercel: invite under Settings, Members, Invite. They get an email link to join the project.
3. Neon: the free tier supports one user per project, so either transfer the project to their email or share the connection string and have them paste it into their own Vercel.
4. Upstash: same as Neon. Share connection string or transfer.
5. Brevo: either share the API key (and rotate yours after) or have them sign up fresh and update `SMTP_PASS` in Vercel.
6. Expo: invite under Account, Members. They join the Expo organisation. The mobile app's `projectId` in `app.json` keeps pointing at the existing project so they can build new APKs immediately.
7. cron-job.org: they can sign up fresh and recreate the single cron job in two minutes (URL `https://cyberscore-api.vercel.app/api/v1/keepwarm`, every two minutes).

### Before transfer: rotate every long-lived secret

Run through this list once before sending the handover email. The current secrets passed through development chats and IDE windows, so they should not be the long-lived production secrets.

- [ ] Rotate `JWT_SECRET`. Invalidates all existing access tokens.
- [ ] Rotate `REFRESH_TOKEN_SECRET`. Invalidates all refresh tokens, forces a re-login.
- [ ] Rotate `TOTP_ENCRYPTION_KEY` only if you also wipe existing TOTP enrolments. Fine for this demo. Warn users in production.
- [ ] Regenerate the Brevo API key and update Vercel.
- [ ] If Anthropic was ever switched on, regenerate that key too.
- [ ] Reset the Neon and Upstash connection passwords if they were shared via chat at any point.
- [ ] Confirm `.env` is not in git history: `git log --all --full-history --source -- '*/.env'` must return no output.

---

## 15. Versioning and Releases

Status: Done.

Each release is a Git tag of the form `vX.Y.Z`. The CHANGELOG follows Keep a Changelog format with explicit Added, Changed, and Fixed sections per version.

| Item | Status | Where |
|---|---|---|
| Version tags | Done | `v0.1.0` (initial docs and scaffolding), `v0.2.0` (advisor and RLS), `v0.3.0` (live deployment and demo). `v0.3.1` content is committed; the tag itself is pending the pre-handover commit. |
| CHANGELOG maintained | Done | `CHANGELOG.md`. Four release sections including v0.3.1. |

---

## 16. Contribution Guidelines

Status: Done.

`CONTRIBUTING.md` covers branching strategy, commit message format, the pull-request process, code style expectations, secret-handling rules, dependency update workflow, and the release procedure.

| Item | Status | Where |
|---|---|---|
| Branching strategy | Done | `CONTRIBUTING.md`, Branching section. `main` is protected. Feature branches are `feat/<short-name>`, fixes are `fix/<short-name>`, and so on. |
| Commit message format | Done | `CONTRIBUTING.md`, Commits section. Conventional Commits: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`. |
| Pull request process | Done | `CONTRIBUTING.md`, Pull requests section. PR body must answer What, Why, and How to verify. Template included. |

---

## 17. GitHub Hygiene

Status: Mostly done.

| Item | Status | Notes |
|---|---|---|
| Issues cleaned and labeled | Partial | No open issues at handover. The next batch should open issues for each roadmap item and known-issue line item, labelled `bug`, `feature`, `tech-debt`, or `good-first-issue`. |
| TODOs converted to issues | Partial | No TODO or FIXME comments left in the code. Open work items live in `docs/known-issues.md` and `docs/roadmap.md`. Convert them to GitHub issues after handover. |
| Dead branches removed | Done | Only `main` exists on the remote. Verify with `git branch -r`. |
| `.env` never committed | Done | Verified with `git log --all --full-history --source -- '*/.env'`. Returns nothing. Git history was also rewritten once during Sprint 5 to fix the commit author email mismatch with Vercel. |

---

## 18. License

Status: Done.

The repository is MIT licensed. The copyright line is held jointly by Saanvi Vishal and the International Institute of Information Technology, Bangalore. The MIT license is the most permissive standard open-source license and matches the supervisor checklist's "MIT or Apache" guidance. Anyone, including the next student batch, FISST, or IIIT-B, can freely use, modify, and build on the codebase under the terms of the license.

| Item | Status | Where |
|---|---|---|
| License file present | Done | `LICENSE` |

---

## 19. Handover Notes

Status: Done.

The full narrative is in `docs/handover-notes.md`. Twelve key decisions, five challenges, eight lessons learned, a tips-for-the-next-batch list, and a "things to avoid" list. Headlines for the supervisor:

| Item | Status | Where |
|---|---|---|
| Key decisions explained | Done | `docs/architecture.md` (seven architectural decisions) plus `docs/handover-notes.md` (twelve product-level decisions made during the build) |
| Challenges faced | Done | `docs/handover-notes.md`, Challenges section: macOS Gatekeeper blocking Android Studio, the five-stage Vercel deployment debugging saga, the Resend to Brevo email pivot, the cold-start mitigation discovery, the BullMQ queue without a worker |
| Lessons learned | Done | `docs/handover-notes.md`, eight lessons that would shorten the next batch's timeline by an estimated two weeks |
| Tips for next batch | Done | `docs/handover-notes.md`, "Before you touch anything, do these five things" section |
| Things to avoid | Done | `docs/handover-notes.md`, common rabbit holes: SMTP from Vercel, Android Studio for an Expo project, BullMQ without a worker, Anthropic without a budget guard, RLS-disable shortcuts |

---

## 20. Miscellaneous

| Item | Status | Notes |
|---|---|---|
| Docker setup | Deferred | Not needed for the current Vercel deployment. `next.config.ts` already configures `output: 'standalone'` for non-Vercel hosts, so a future Dockerfile is roughly half a day of work. Skipping it now keeps the repo focused on what is actually used. |
| Setup automation script | Done | `scripts/setup.sh` bootstraps a fresh clone in one command. |
| Demo-user seed script | Done | `apps/api/scripts/seed-demo-user.ts`. Plants the verified demo user against any database URL. Idempotent. Used to seed Neon production. |
| Makefile or CLI shortcuts | Deferred | The npm scripts in `package.json` cover this. A Makefile would just wrap them. |

---

## Folder structure compliance

The supervisor's checklist suggests a single-app layout. Our structure is a monorepo so the top-level `src/` does not apply. We replace it with `apps/` (api and mobile) and `packages/` (sdk and types). Everything else maps directly.

| Suggested in the checklist | Our equivalent | Status |
|---|---|---|
| `src/` | `apps/` and `packages/` | Done |
| `docs/requirements/` | `docs/requirements.md` (single file is easier end-to-end) | Done |
| `docs/design/` | `docs/system-design.md` | Done |
| `docs/architecture/` | `docs/architecture.md` | Done |
| `docs/sprints/` | `docs/sprints.md` | Done |
| `docs/deployment/` | `docs/deployment.md` | Done |
| `tests/` | Empty. Tests will colocate next to source as `*.test.ts` when added (vitest auto-discovery). | Not started |
| `scripts/` | `scripts/setup.sh` | Done |
| `.env.example` | Root plus per app | Done |
| `README.md` | `README.md` | Done |
| `HANDOVER_CHECKLIST.md` | This file | Done |
| `CHANGELOG.md` | `CHANGELOG.md` | Done |
| `docker-compose.yml` | Not added. See section 20. | Deferred |

---

## Final pre-handover checklist

Run through this list right before emailing Mohan Ram C.

Completed:

- All 20 sections above have at least a Partial status.
- `git status` is clean.
- `npm run typecheck` passes with zero errors.
- `npm run lint` passes.
- `scripts/setup.sh` runs cleanly on a fresh clone.
- `.env` is not committed. `git log --all -- '*/.env'` returns nothing.
- Repository pushed to GitHub with the `v0.3.0` tag. The `v0.3.1` tag is pending the next push.
- Vercel API responds 200 at `/api/v1/health`.
- Neon database seeded with the KPI catalogue and the demo user (now ENTERPRISE mode).
- Demo APK installed and tested on a Samsung phone.
- Demo video recorded (around four to five minutes).
- Demo video uploaded to IIIT Bangalore SharePoint. Link in README and in this file.
- Final report PDF generated (`docs/cyberscore-final-report.pdf`).

Still pending:

- Presentation slides assembled from the outline in the final report PDF.
- FISST account added as a GitHub repository collaborator.
- All long-lived secrets rotated per section 14.
- Handover email sent to Mohan Ram C with: this checklist, the demo video link, the slides, the final report PDF, the repository link, and the demo account credentials.

---

CyMetric is handover-ready as of 2026-05-19. The project is fully deployed, demoable, and documented. A new developer can clone the repository, run `scripts/setup.sh`, and have a working local development environment in under ten minutes. The supervisor and FISST can also try the deployed app directly by installing the APK from the EAS link, without cloning anything.
