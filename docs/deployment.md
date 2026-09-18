# Deployment

> **Status: LIVE in production as of 2026-05-18.** This document describes the **actual deployed setup** of CyMetric, not a plan. The API is running on Vercel, the database on Neon, Redis on Upstash, email via Brevo, and the Android APK is built and distributed through Expo EAS. Everything described here has been executed, verified, and used in the demo recording.
>
> If the next batch deploys to a different stack, please update this document to reflect their changes instead of layering new options on top.

## Live URLs

| Surface | URL | Free tier |
|---|---|---|
| API | https://cyberscore-api.vercel.app | Vercel Hobby (free) |
| API health | https://cyberscore-api.vercel.app/api/v1/health |, |
| Database | Neon Postgres, Singapore region (`ap-southeast-1`) | Neon Free (3 GB storage, 1 compute hour/day) |
| Redis | Upstash Redis, Singapore region (`ap-southeast-1`) | Upstash Free (10k commands/day) |
| Email delivery | Brevo HTTP API (`api.brevo.com/v3/smtp/email`) | Brevo Free (300 emails/day) |
| Mobile APK | Expo EAS Build artifact URL (regenerated each build) | EAS Free (30 builds/month) |
| Keep-warm cron | cron-job.org, hits `/api/v1/health` every 2 minutes | Free, unlimited |

Total monthly cost at handover: **$0**. All services on free tiers.

## What gets deployed

Three independently deployed components:

1. **API** (Next.js 15), stateless route handlers running as Vercel serverless functions
2. **Mobile APK** (Expo SDK 52), Android package, distributed as a direct download from EAS Build
3. **Background workers**: *not currently deployed.* The original design had a separate BullMQ worker process for email / snapshot / push / abandonment, but on Vercel-only deployments emails are sent inline (no worker needed) and the snapshot job runs synchronously in the request that triggers it. Other queue types (push, abandonment) are dormant, wire them up to a Render Background Worker or Fly.io machine if the corresponding features are ever needed.

Plus three managed services (Neon, Upstash, Brevo).

---

## How to deploy from scratch (for the next batch)

If you're cloning the repo and standing up your own deployment, follow these steps in order.

### Step 1, Postgres on Neon

1. Sign up at https://neon.tech with your work email. Free tier, no credit card.
2. Create a project: pick **Singapore (`ap-southeast-1`)** or whichever region matches your users. Region affects latency.
3. From the dashboard, copy two connection strings:
   - **Pooled** (port 5432, used at runtime by the API): `postgresql://...neon.tech/neondb?sslmode=require`
   - **Direct** (used by Prisma migrations): same host, no `pooler` keyword
4. Save these as `DATABASE_URL` and `DIRECT_DATABASE_URL` for Step 5.

### Step 2, Redis on Upstash

1. Sign up at https://upstash.com. Free tier.
2. Create a Redis database: pick the same region as your Neon DB (Singapore). Eviction policy: `noeviction`.
3. Copy the **TLS connection string** (starts with `rediss://...`, port 6379).
   - **Not** the HTTP REST URL. We use the standard Redis wire protocol via `ioredis`.
4. Save as `REDIS_URL`.

### Step 3, Email via Brevo

1. Sign up at https://www.brevo.com. Free tier (300 emails/day, no credit card).
2. During signup, your email is automatically verified as a sender.
3. Go to **Settings → SMTP & API → API Keys** (or directly: https://app.brevo.com/settings/keys/api).
4. Click **Generate a new API key** → name it `cymetric-vercel` → Generate.
5. Copy the key (starts with `xkeysib-...`). Brevo only shows it once.
6. Save as `SMTP_PASS`.

> **Note:** We send email via Brevo's **HTTP API**, not SMTP. Vercel serverless functions are unreliable for raw outbound TCP on port 465/587, they sometimes hang for the function's full execution budget. The `apps/api/src/lib/email.ts` file auto-detects Brevo API keys (prefix `xkeysib-`) and routes through `https://api.brevo.com/v3/smtp/email`. SMTP credentials are also configured but unused at runtime.

The other "SMTP" env vars are still required by the code's Zod env validation, but their values don't matter when a Brevo API key is set:

```env
SMTP_HOST=smtp.relay.brevo.com    # not used, but must be set
SMTP_PORT=587                      # not used, but must be set
SMTP_USER=resend                   # legacy, not used
SMTP_PASS=xkeysib-your-key-here    # this is what matters
SMTP_FROM=CyMetric <noreply@yourdomain.com>  # display name; Brevo rewrites the email part
```

### Step 4, Vercel API deployment

1. Push the repo to GitHub.
2. Sign up at https://vercel.com with your GitHub account.
3. **Add New → Project →** pick the `cymetric` repo.
4. Configure:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `apps/api`
   - **Build Command:** leave default (`turbo run build --filter=@cymetric/api` happens automatically via the workspaces setup)
   - **Output Directory:** leave default (`.next`)
   - **Install Command:** leave default (`npm install`)
   - **Node version:** 22.x (set in root `package.json` `engines` field)
5. Click **Environment Variables** → add all the vars from Step 5 below. Mark `SMTP_PASS`, `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `TOTP_ENCRYPTION_KEY` as **Sensitive**. Apply to Production + Preview + Development.
6. Click **Deploy**. First build takes ~3 minutes.

The custom domain `cyberscore-api.vercel.app` is auto-assigned; you can attach a custom domain later in Project Settings → Domains.

### Step 5, Environment variables

Production env vars (set in Vercel Project Settings):

```env
# --- Runtime ---
NODE_ENV=production

# --- Database (Neon, Singapore) ---
DATABASE_URL=postgresql://neondb_owner:***@***.pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
DIRECT_DATABASE_URL=postgresql://neondb_owner:***@***.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# --- Redis (Upstash, Singapore) ---
REDIS_URL=rediss://default:***@***.upstash.io:6379

# --- Auth (generate fresh; do not reuse these) ---
JWT_SECRET=<64+ random chars from `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<another 64+ random chars>
REFRESH_TOKEN_EXPIRES_IN=7d

# --- TOTP encryption ---
TOTP_ENCRYPTION_KEY=<exactly 64 hex chars from `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`>

# --- Email via Brevo (HTTP API path) ---
SMTP_HOST=smtp.relay.brevo.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=xkeysib-<your-brevo-api-key>
SMTP_FROM=CyMetric <noreply@cymetric.app>

# --- AI advisor: local (free) vs Anthropic ---
USE_LOCAL_ADVISOR=true
# Only set the next two if USE_LOCAL_ADVISOR=false:
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL_PRIMARY=claude-sonnet-4-6
# ANTHROPIC_MODEL_FALLBACK=claude-haiku-4-5
# ANTHROPIC_DAILY_BUDGET_USD=50

# --- Rate limits ---
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_LOGIN_WINDOW_MS=900000

# --- Optional: only if you've set up R2 / Sentry / Expo push ---
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_BUCKET=cymetric-evidence
# R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
# R2_PUBLIC_URL=https://evidence.cymetric.app
# EXPO_ACCESS_TOKEN=
# SENTRY_DSN=
```

To generate strong secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT / REFRESH
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"          # TOTP (must be exactly 64 hex chars)
```

### Step 6, Run migrations against Neon

From your laptop, with `DATABASE_URL` and `DIRECT_DATABASE_URL` pointing at Neon:

```bash
cd apps/api
DIRECT_DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" \
  npx prisma migrate deploy
```

This applies all migrations in `apps/api/prisma/migrations/` in order:

1. `20260423115340_init`, base 21-table schema
2. `20260429000000_enterprise_mode`, added OrgMode / JoinMode / AnswerScope, invites, enterprise org fields
3. `20260429000001_per_user_progress`, moved `assessment_progress` from org-keyed to (org, user)-keyed
4. `20260506080246_add_allowed_levels`, added `User.allowedLevels` and `Invite.allowedLevels`
5. `20260516074342_add_chat_threads`, chat thread + chat message tables
6. `20260516123040_add_response_matched_tier_relation`, added FK Response → ScoringTier (with orphan cleanup)
7. `20260516123100_rls_policies`, enabled Row-Level Security on 19 tenant-scoped tables

### Step 7, Seed the KPI catalogue

```bash
cd apps/api
DATABASE_URL="postgresql://...pooler.../neondb?sslmode=require" \
  npm run db:seed
```

This populates 46 KPIs + 212 scoring tiers + 92 personalised remediation suggestions (extracted from `SCORE CARD_KPI_CYBER SEC_PPT_V0.9.xlsx`).

### Step 8, Plant the demo user

```bash
cd apps/api
DATABASE_URL="postgresql://...pooler.../neondb?sslmode=require" \
  npx tsx scripts/seed-demo-user.ts
```

This creates `saanvi.vishal@iiitb.ac.in` / `cyberscore-demo-2026` as a verified SOLO admin in the "IIIT Bangalore" org (Banking industry). Idempotent, re-running just updates the row. Customise the email/password via env vars:

```bash
DEMO_EMAIL=test@example.com \
DEMO_PASSWORD='Strong-pass-2026' \
DEMO_ORG_NAME='Test Co' \
DEMO_INDUSTRY='Technology' \
DEMO_NAME='Test User' \
  npx tsx scripts/seed-demo-user.ts
```

### Step 9, Verify the API

```bash
curl -s https://cyberscore-api.vercel.app/api/v1/health | jq
```

Expected response:
```json
{
  "ok": true,
  "uptimeMs": 12247,
  "latencyMs": {
    "database": 89,
    "redis": 41
  },
  "checks": { "database": "ok", "redis": "ok" }
}
```

If any check returns `"fail"`, that service isn't reachable, review the env var for that service.

### Step 10, Set up the keep-warm cron

Vercel's Hobby tier shuts down idle serverless functions after ~5 minutes. The first request after idle pays a 5-10 second cold-start tax, which kills the demo experience. Mitigation: an external cron pings the health endpoint every 2 minutes to keep functions warm.

1. Sign up at https://console.cron-job.org (free, no credit card).
2. Click **CREATE CRONJOB**.
3. Fill in:
   - **Title:** `CyMetric keep-warm`
   - **URL:** `https://cyberscore-api.vercel.app/api/v1/health`
   - **Schedule:** every 2 minutes (cron expression `*/2 * * * *`)
   - **HTTP method:** GET
4. Click **CREATE**.
5. Verify in **Executions** tab that pings are landing with status 200.

This single cron also incidentally warms most other serverless functions on Vercel because their Fluid Compute feature shares warm instances across routes within a project. For maximum warmth across all routes, you can add additional cron jobs (cron-job.org free tier supports unlimited jobs).

### Step 11, Build the mobile APK

Build the Android APK from `apps/mobile/` using EAS Build:

```bash
# One-time setup
cd apps/mobile
eas login                              # interactive auth, or:
export EXPO_TOKEN=<your-expo-token>    # for non-interactive / CI

# First-time: link the project to your Expo account
eas init
# When asked "Would you like to create a project for @your-username/cymetric?" → Y

# Trigger an Android build using the 'preview' profile (defined in eas.json)
eas build --platform android --profile preview
```

`eas.json` already defines:
- `preview` profile, produces an APK suitable for sideload (used for demo + internal testing)
- `production` profile, produces an AAB suitable for Play Store

Both profiles bake `EXPO_PUBLIC_API_URL=https://cyberscore-api.vercel.app` into the bundle so the APK talks to the live API.

Build runs in Expo's cloud (~12-15 min). When done, you get a download URL like `https://expo.dev/artifacts/eas/<uuid>.apk`. To distribute:

- **For supervisors / internal testers:** share the URL or QR code. They open it on their phone's Chrome → Download → Install. Android will ask "Install from unknown sources?" once → tap **Allow** → install completes.
- **For Play Store:** use the `production` profile then `eas submit --platform android --latest`.

### Step 12, Verify the APK

Install on a real Android phone (an emulator works too). After install:

1. Onboarding carousel appears (3 slides, Security Scans / Live Scorecard / AI Insights)
2. Tap Skip or Next-Next-Next → Login screen
3. Enter `saanvi.vishal@iiitb.ac.in` / `cyberscore-demo-2026`
4. Tap Login → Dashboard hydrates with the IIIT Bangalore org's scorecard
5. Tap Analytics → trend chart + suggestions appear
6. Tap Chat → ask "where am I weakest?" → local advisor streams a Banking-specific reply
7. Tap Profile → log out
8. Tap **Forgot password?** → enter email → submit → check IIITB Outlook (an OTP arrives via Brevo within 10 seconds)
9. Enter OTP → set new password → log back in

If all 9 steps work, the deployment is complete. Done

---

## How updates ship

### API code changes

Every push to `main` triggers a Vercel auto-deploy. Build takes ~3 minutes. Watch the **Deployments** tab; the new deployment shows "Building" → "Ready" with a green checkmark. The custom domain auto-routes to the latest "Ready" deployment.

To roll back: in Vercel dashboard → Deployments → find a previous deploy → click ⋯ → **Promote to Production**.

### Database migrations

Migrations don't auto-run on Vercel. After pushing a migration, manually run from your laptop:

```bash
cd apps/api
DIRECT_DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require' \
  npx prisma migrate deploy
```

This is by design, running migrations from CI would let any preview deployment touch the production database. Manual is safer for a small team.

For a next-batch CI improvement: add a GitHub Actions workflow that runs migrations against a staging Neon project on PR + against production only after manual approval.

### Mobile app updates

Two paths depending on whether the change touches native code:

- **JavaScript-only changes** (UI, state, anything not involving native modules): use `eas update --branch preview --message "..."` which pushes an Over-The-Air update. Users on the latest binary pick it up on the next app launch, no reinstall.
- **Native changes** (new permissions, new native module, native config): full rebuild required via `eas build`. Users must download + install the new APK.

The current handover build uses the static (non-OTA) channel. If the next batch wants OTA, configure `EAS Update` in `eas.json` and run `eas update:configure`.

### Env var changes

Updating an env var in Vercel **does not** auto-redeploy. To make a new env var take effect:

1. Update the value in Vercel → Settings → Environment Variables → Save
2. Either click **Redeploy** in the blue banner that appears, OR
3. Push an empty commit to trigger redeploy:
   ```bash
   git commit --allow-empty -m "chore: redeploy for env var update" && git push
   ```

Vercel bakes env vars into the build, so the new value only applies after a fresh build.

---

## Backups

| Service | Backup strategy | Restore procedure |
|---|---|---|
| Neon Postgres | Neon's built-in point-in-time recovery (7 days of WAL retention on Free tier) | Neon dashboard → Branches → restore to a new branch from any moment in the last 7 days |
| Upstash Redis | No backups needed, Redis state is reconstructible (queue jobs replay, rate-limit windows are short-lived, no durable data) | n/a |
| Brevo email logs | Brevo retains send history for 30 days on free tier | Dashboard → Transactional → Statistics |
| R2 / S3 evidence | When wired: enable versioning on the bucket; lifecycle rule for 90-day version retention | Bucket history |

For production beyond a demo: enable daily logical backups via `pg_dump` to S3, retained for 30 days. Neon's free tier doesn't include this; upgrade to Launch ($19/mo) for daily backups + 30-day PITR.

---

## Observability

What's in place at handover:

- **Logs:** Vercel Functions tab streams the function's stdout. Pino emits structured JSON, so logs are queryable in Vercel's UI by JSON keys (route, level, msg, err).
- **Health checks:** `/api/v1/health` validates DB + Redis. External monitor (cron-job.org) hits it every 2 minutes and would alert via email if it ever returned non-200.

What's missing, leave for the next batch:

- **Errors:** Sentry is wired in `apps/api/instrumentation.ts` but `SENTRY_DSN` is unset, so errors only go to logs. Add a free Sentry account + paste the DSN to capture exceptions with stack traces.
- **Metrics:** No metrics pipeline. Recommended: OpenTelemetry SDK (env var `OTEL_EXPORTER_OTLP_ENDPOINT` already supported in env.ts) → Grafana Cloud or Honeycomb free tier.
- **Uptime alerting:** cron-job.org would notify on failure but emails go to the cron-job.org account email. For real on-call: Better Stack / UptimeRobot.

---

## Rollback

| Component | How to roll back |
|---|---|
| API code | Vercel dashboard → Deployments → click ⋯ on a known-good deployment → Promote to Production. Instant. |
| Database schema | Prisma has no automatic rollback. To revert a migration: write a counter-migration that undoes the changes, then `prisma migrate deploy`. Always test on a Neon branch first. |
| Mobile binary | If the new APK has a regression and was distributed via direct download: re-share the previous APK URL (Expo keeps build artifacts for 30 days). Users install over the existing app. |
| OTA update | `eas update:rollback --branch preview` reverts to the previous published JS bundle. |
| Env vars | Update the value in Vercel → Redeploy. |

---

## Cost projection, for context

The handover deployment runs on **$0/month** thanks to free tiers. For comparison, a real production stack at ~1000 active orgs would look like:

> **These are list prices, not figures CyMetric has paid.** Use as order-of-magnitude only.

| Service | Tier | List price |
|---|---|---|
| Vercel (API) | Pro | $20 + usage |
| Neon (Postgres) | Launch | $19 |
| Upstash (Redis) | Pay-as-you-go | ~$10 |
| Brevo (email) | Lite | $9 (20k emails/month) |
| Cloudflare R2 (evidence storage) | Pay-as-you-go | ~$5 |
| Anthropic API (chat) | Pay-as-you-go | Variable, see daily budget guard |
| Sentry | Team | $26 |
| Expo EAS | Production | $99 |
| cron-job.org | Free | $0 |
| **Total** | | **~$190/mo + AI usage** |

The local rule-based advisor (currently default, `USE_LOCAL_ADVISOR=true`) means **AI cost = $0**. Switch to Anthropic Sonnet when you want richer responses; the daily budget guard caps spend. With prompt caching on the system block (containing the scorecard JSON), per-chat-turn cost after the first turn within the 5-min cache window drops to fractions of a cent.

---

## CI/CD, to be added by the next batch

There is **no GitHub Actions workflow yet** because there are no tests to run. The deployment pipeline today is:

```
git push origin main → Vercel auto-detects → npm install → turbo build → deploy
```

When tests exist, drop in a workflow like this:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: cymetric_test
        ports: ['5432:5432']
        options: --health-cmd pg_isready
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx turbo run typecheck
      - run: npx turbo run lint
      - run: npx turbo run test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/cymetric_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: ${{ secrets.CI_JWT_SECRET }}
          REFRESH_TOKEN_SECRET: ${{ secrets.CI_REFRESH_SECRET }}
```

Then add a `deploy.yml` that runs `prisma migrate deploy` against a staging Neon branch on PR + against production on merge to `main`.

---

## Troubleshooting

Issues we hit during the v0.3.0 deployment, with their root cause + fix. Save your next batch some hours.

### `npm run worker` exits with code 1

Cause: `.env` has a placeholder like `R2_ENDPOINT=https://<accountid>...` which fails Zod URL validation at boot.

Fix: comment out unused placeholder env vars in `.env`.

### Vercel build fails with "Could not find declaration file for module 'bcrypt'"

Cause: TypeScript checked the `scripts/` directory which uses `bcrypt` from a script that's not built with the main app.

Fix: in `apps/api/tsconfig.json`, add `"scripts"` to the `exclude` array.

### Vercel build succeeds but deployment is "Blocked"

Cause: deployment was blocked due to either (a) a vulnerable dependency version (CVE), (b) an account mismatch between the commit author email and the Vercel account email.

Fix:
- For CVE: upgrade the affected package (we hit CVE-2025-66478 on Next.js 15.1.3 → upgraded to 15.5.18).
- For account email: rewrite git history with `git filter-branch` to use the email that matches your Vercel account, then force-push.

### `/api/v1/auth/password-reset/request` returns 500 after env vars are set

Cause: the email job is being added to BullMQ, but no worker is running anywhere to drain the queue. So the API request hangs at `queue.add(...)` until the function times out.

Fix: `apps/api/src/lib/queue.ts` has been patched so `enqueueOtpEmail` and `enqueueInviteEmail` call `sendEmail()` directly (HTTP-based, fast) instead of going through Redis. The function names stay the same so all call sites work unchanged.

### Emails accepted by SMTP provider but never arrive

Cause: Vercel sometimes throttles or drops raw outbound TCP on port 465/587 for serverless functions. Nodemailer's `transport.sendMail()` then hangs for the full request budget.

Fix: switched to email provider's HTTP API (Brevo's `api.brevo.com/v3/smtp/email`, or Resend's `api.resend.com/emails`). `apps/api/src/lib/email.ts` auto-detects the provider from the `SMTP_PASS` prefix:

- `xkeysib-*` → Brevo HTTP
- `re_*` → Resend HTTP
- Anything else → nodemailer SMTP (works on non-Vercel deployments)

### App on phone has 10-second lag between every screen transition

Cause: each Next.js route is a separate Vercel serverless function. On Hobby tier they go idle after ~5 min, and the first request after idle pays a 5-10 second cold-start tax.

Fix: external cron at https://console.cron-job.org pings `/api/v1/health` every 2 minutes. Vercel's Fluid Compute keeps adjacent functions warm too. Cold-start tax drops from 5-10s to ~200ms.

### `/api/v1/auth/login` validates correct credentials but returns "Invalid email or password"

Cause: the user's `passwordHash` in the database is from a different Argon2 cost, or the user doesn't exist in the deployment target's database (e.g. you seeded local DB but the API is hitting Neon).

Fix: run `apps/api/scripts/seed-demo-user.ts` against the actual production DATABASE_URL. The script is idempotent, re-running just upserts the hash with the current code.

---

## Where to put new env vars

When adding a new env var:

1. Add to `apps/api/src/lib/env.ts` with a Zod schema definition (this enforces presence at boot).
2. Add to `.env.example` (root) with a comment explaining what it's for.
3. Add to `apps/api/.env.example` (same content, scoped to the API).
4. Add to Vercel → Settings → Environment Variables (Production + Preview + Development).
5. Document the var in this file (deployment.md) if it's a production concern.
6. Add to `turbo.json`'s `globalEnv` if the build needs to see it.