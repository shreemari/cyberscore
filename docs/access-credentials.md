# Access & Credentials

How every external service CyMetric uses is set up, where the secrets live, and how to transfer control to the next batch.

> **Rule:** No actual secret values are written in this file or anywhere else in the repo. Secrets live in two places only: (1) Vercel Project Settings → Environment Variables, and (2) `apps/api/.env` on Saanvi's local machine (gitignored). Everything else is the *name* of the secret and *where to find it*, never the value.

---

## Service inventory

Every external service CyMetric depends on at handover, with login URL, free-tier status, and what's stored there.

| # | Service | Purpose | Account owner | URL | Free tier? |
|---|---|---|---|---|---|
| 1 | GitHub | Source code | `saanvivishal@gmail.com` (`@saanvivishal`) | https://github.com/saanvivishal/cyberscore | Free |
| 2 | Vercel | API hosting | `saanvivishal@gmail.com` | https://vercel.com/saanvivishals-projects/cymetric-api | Hobby (free) |
| 3 | Neon | Production Postgres | `saanvivishal@gmail.com` | https://console.neon.tech | Free (3 GB storage) |
| 4 | Upstash | Production Redis | `saanvivishal@gmail.com` | https://console.upstash.com | Free (10k commands/day) |
| 5 | Brevo | Transactional email | `saanvivishal@gmail.com` | https://app.brevo.com | Free (300 emails/day) |
| 6 | Expo / EAS | Mobile builds | Expo username `saanviiiiiiiiiiiiii` (GitHub OAuth) | https://expo.dev/accounts/saanviiiiiiiiiiiiii | Free (30 builds/month) |
| 7 | cron-job.org | Keep-warm pings | `saanvivishal@gmail.com` | https://console.cron-job.org | Free |
| 8 | Anthropic | AI chat (optional, disabled by default) | `saanvivishal@gmail.com` | https://console.anthropic.com | Pay-as-you-go (currently $0 balance, hence `USE_LOCAL_ADVISOR=true`) |

**Total monthly cost at handover: $0.**

---

## Where secrets live

### Production (Vercel Environment Variables)

The Vercel console (Project → Settings → Environment Variables) is the single source of truth for production secrets. Each var is configured for **Production + Preview + Development**.

| Variable | Sensitive? | What it is | Where to regenerate |
|---|---|---|---|
| `DATABASE_URL` | Done Yes | Neon pooled connection string | Neon console → project → Connection details → "Pooled connection" |
| `DIRECT_DATABASE_URL` | Done Yes | Neon direct connection (for migrations) | Neon console → "Direct connection" |
| `REDIS_URL` | Done Yes | Upstash TLS connection (`rediss://...`) | Upstash console → database → Details → "Endpoint" |
| `JWT_SECRET` | Done Yes | 64+ random chars for signing access tokens | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `REFRESH_TOKEN_SECRET` | Done Yes | 64+ random chars for signing refresh tokens | Same command as JWT_SECRET |
| `TOTP_ENCRYPTION_KEY` | Done Yes | Exactly 64 hex chars for encrypting TOTP secrets at rest | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SMTP_PASS` | Done Yes | Brevo API key (`xkeysib-...`) | Brevo → Settings → SMTP & API → API Keys → Generate new |
| `ANTHROPIC_API_KEY` | Done Yes | Anthropic key (`sk-ant-...`), currently unset because `USE_LOCAL_ADVISOR=true` | Anthropic Console → API Keys |
| `JWT_EXPIRES_IN` | No | `15m` | Static |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `7d` | Static |
| `SMTP_HOST` | No | `smtp.relay.brevo.com` (legacy, not used by HTTP path) | Static |
| `SMTP_PORT` | No | `587` (legacy, not used by HTTP path) | Static |
| `SMTP_USER` | No | `resend` (legacy, not used) | Static |
| `SMTP_FROM` | No | `CyMetric <noreply@cymetric.app>`, display name; Brevo rewrites the email part | Static |
| `USE_LOCAL_ADVISOR` | No | `true` (default), flip to `false` to use Anthropic | Static |
| `NODE_ENV` | No | `production` | Static |
| `RATE_LIMIT_LOGIN_MAX` | No | `5` | Static |
| `RATE_LIMIT_LOGIN_WINDOW_MS` | No | `900000` (15 min) | Static |

### Local development (`apps/api/.env`)

Same set of variables as production, but with **local Postgres + Redis** (or you can point them at Neon + Upstash too, many devs do this).

`.env` is in `.gitignore`. Verify with:

```bash
git log --all --full-history --source -- '*/.env'
```

This should return **no output**. If it returns commits, `.env` was accidentally committed and the history needs `git filter-repo` to scrub.

The `.env.example` files at the repo root + `apps/api/.env.example` document every variable with comments. Copy `.env.example` → `.env` and fill in the values from the table above.

### Mobile app (build-time env, baked into APK)

The APK doesn't store secrets, it just stores the **API URL**:

| Variable | Value | Where set |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://cyberscore-api.vercel.app` | `apps/mobile/eas.json` (preview + production profiles) |

The `EXPO_PUBLIC_` prefix is required by Expo to inline the value into the JS bundle at build time. Anything without this prefix is *not* available to the mobile app at runtime.

---

## Account-by-account setup history

### 1. GitHub

- **Account:** `@saanvivishal` (linked to `saanvivishal@gmail.com`)
- **Repo:** https://github.com/saanvivishal/cyberscore
- **Visibility:** Currently private. Make public before handover, or invite Mohan Ram C as a collaborator.
- **Important:** All commits are authored as `saanvivishal@gmail.com`. History was rewritten once during Sprint 5 to fix an author email mismatch with Vercel. Confirm with `git log --pretty='%an <%ae>'`, every commit should show the gmail address.

### 2. Vercel

- **Account email:** `saanvivishal@gmail.com`
- **Plan:** Hobby (free)
- **Team:** `saanvivishals-projects` (auto-created on signup)
- **Project:** `cymetric-api`
- **Production domain:** `cyberscore-api.vercel.app`
- **Auto-deploy:** every push to `main` triggers a build. Settings → Git → "Production Branch" = `main`.
- **Build settings:**
  - Framework Preset: Next.js
  - Root Directory: `apps/api`
  - Node version: 22.x
  - Install Command: default
  - Build Command: default (Vercel handles the monorepo via Turbo)

### 3. Neon (Postgres)

- **Account email:** `saanvivishal@gmail.com`
- **Plan:** Free
- **Region:** Singapore (`ap-southeast-1`), chosen for low latency to Indian users
- **Project:** `cymetric` (default branch `main`)
- **Database:** `neondb`
- **Owner role:** `neondb_owner`
- **Migrations:** 7 migrations applied, see `apps/api/prisma/migrations/`
- **Seed data:** 46 KPIs, 212 scoring tiers, 92 KPI suggestions, 1 demo org + user

To run migrations against this Neon DB (from your laptop):

```bash
cd apps/api
DIRECT_DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require' \
  npx prisma migrate deploy
```

### 4. Upstash (Redis)

- **Account email:** `saanvivishal@gmail.com`
- **Plan:** Free
- **Region:** Singapore (`ap-southeast-1`)
- **Database name:** `cymetric-redis` (or similar, check console)
- **Eviction policy:** `noeviction`
- **TLS:** enforced (connection string starts with `rediss://`)
- **What's stored:**
  - BullMQ queue jobs (currently dormant on Vercel, email is inline, snapshots run synchronously)
  - Rate-limit windows (sliding-window counters keyed by IP / userId)
  - The KPI catalogue cache (`lib/kpis-cache.ts`, TTL ~10 minutes)

### 5. Brevo (Email)

- **Account email:** `saanvivishal@gmail.com`
- **Registered as:** "iiit bangalore" (org name)
- **Plan:** Free (300 emails/day)
- **Verified sender:** `saanvivishal@gmail.com` (auto-verified at signup)
- **Daily quota:** 300 emails, comfortably above the demo's needs

**Critical detail about the "From" address:**

Even though we configure `SMTP_FROM='CyMetric <saanvivishal@gmail.com>'` in Vercel, Brevo **rewrites the envelope From** to its own relay domain when the sender isn't a verified custom domain. So the actual `From` header that recipients see is:

```
CyMetric <saanvivishal@11248643.brevosend.com>
```

The display name "CyMetric" is preserved. The personal gmail address never appears in outbound mail. Recipients see "CyMetric" in their inbox preview; only the technical metadata shows the relay address.

If you want to remove the personal name from the relay domain too: in Brevo console → Settings → Senders, domains, IPs → add a new sender with a different local-part (e.g. `noreply@cymetric.app`). Brevo sends a verification email to that address; once verified, the relay rewrites to `noreply@...brevosend.com`. Cleaner for production.

### 6. Expo / EAS

- **Username:** `saanviiiiiiiiiiiiii` (signed up via GitHub OAuth)
- **Email:** `saanvivishal@gmail.com`
- **Plan:** Free
- **Project:** `cymetric` (ID: `4cddb02b-7be0-47d3-8911-4df45863d418`, in `apps/mobile/app.json`)
- **Auth from CLI:**
  - Interactive: `eas login` (prompts for username + password, but OAuth accounts don't have a password, set one via Settings, or use the token approach)
  - Non-interactive: `export EXPO_TOKEN=<token>` then any `eas` command works
- **Access token:** generated via Expo console → Settings → Access tokens. Currently named `cybersecurity` (created 2026-05-17). Used in the CI-like flow.
- **Android signing keystore:** managed by EAS (`Build Credentials 7nRfjcKsrp`). Never leaves their servers; we don't need to back it up.
- **Build profiles** (in `apps/mobile/eas.json`):
  - `preview`: APK, internal distribution (sideload)
  - `production`: AAB, Play Store

### 7. cron-job.org

- **Account email:** `saanvivishal@gmail.com`
- **Plan:** Free
- **Single job:**
  - Title: `CyMetric keep-warm`
  - URL: `https://cyberscore-api.vercel.app/api/v1/health`
  - Method: GET
  - Schedule: every 2 minutes (`*/2 * * * *`)
  - Notifications: cron-job's default (alerts on failure)

This is the cheapest fix for Vercel cold starts. Without it, the first request after ~5 min idle pays a 5-10 second penalty and the demo feels broken.

### 8. Anthropic (optional)

- **Account email:** `saanvivishal@gmail.com`
- **Status:** $0 balance (chose not to spend on API credits for the demo)
- **`USE_LOCAL_ADVISOR=true`** in Vercel env → all chat calls go to the local rule-based advisor instead
- To switch back: top up the Anthropic account, set `USE_LOCAL_ADVISOR=false`, redeploy. No code changes needed.

---

## Transferring access to the next batch

When the next batch / FISST takes over:

### GitHub

```
Settings → Collaborators → Add people → enter their GitHub username
```

Alternative: transfer ownership to a FISST GitHub organisation:
```
Settings → General → Danger Zone → Transfer ownership
```

### Vercel

```
Settings → Members → Invite team member → enter their email
```

They'll get an email link to join. Once they're in, they see the project alongside their own. The deployment URL stays the same.

If you want to transfer ownership entirely:
```
Project → Settings → General → Transfer Project
```

### Neon

The Free tier supports one user per project. Easiest path: share the connection string out-of-band (e.g. via password manager). They paste it into their own Vercel project's env vars.

For long-term: invite to the Neon team:
```
Console → Settings → Team → Invite
```

### Upstash

Same, share connection string out-of-band. To transfer:
```
Database → Settings → Team Members → Invite
```

### Brevo

Either:
- (a) Share the API key (preferred for short-term, easy)
- (b) They sign up fresh and update `SMTP_PASS` in their Vercel env

Brevo lets you add team members to a single org (Settings → Users), but Free tier has limited seats. Easier to give them their own free account.

### Expo

```
Expo console → Account → Members → Invite
```

Add their email. They'll get an invite to join the same Expo org. The mobile app's `projectId` in `app.json` will keep pointing at the existing project, so they can build new APKs immediately.

### cron-job.org

Easiest: they sign up fresh and recreate the single cron job. Takes 2 minutes.

### Anthropic

If never enabled: nothing to transfer.

If you do enable Anthropic: share the API key, or they generate their own and update `ANTHROPIC_API_KEY` in their Vercel env.

---

## Before transfer, rotate every secret

The current secrets passed through development conversations, IDE windows, screenshots, and chat with AI assistants. They should not be the long-lived production secrets. Run through this list before sending the handover email:

- [ ] **`JWT_SECRET`**: regenerate, update Vercel, redeploy. This invalidates every active access token; users will get 401s on their next request but the refresh-token flow will silently re-issue. No user action needed.
- [ ] **`REFRESH_TOKEN_SECRET`**: regenerate, update Vercel, redeploy. This invalidates every refresh token, forcing all users to log in again. Acceptable for a demo handover.
- [ ] **`TOTP_ENCRYPTION_KEY`**: regenerate **only if** you plan to also wipe existing TOTP enrolments (changing this key bricks existing TOTP secrets). For the demo there are no TOTP enrolments yet, so feel free to regenerate.
- [ ] **`SMTP_PASS`** (Brevo API key), Brevo console → SMTP & API → API Keys → revoke the old one, generate new, update Vercel.
- [ ] **`DATABASE_URL` + `DIRECT_DATABASE_URL`**. Neon console → Settings → Reset password (on the `neondb_owner` role). New connection strings will be generated. Update both vars in Vercel.
- [ ] **`REDIS_URL`**. Upstash console → database → Settings → Reset password. New connection string. Update Vercel.
- [ ] **Expo access token**. Expo console → Settings → Access tokens → revoke the old, generate new, save somewhere safe.
- [ ] If Anthropic was ever used: revoke + regenerate `ANTHROPIC_API_KEY` at https://console.anthropic.com/settings/keys.
- [ ] Verify `.env` is not in any commit ever: `git log --all --full-history --source -- '*/.env'` (must return zero output).
- [ ] Push a single empty commit to force Vercel to redeploy with all the new secrets: `git commit --allow-empty -m "chore: rotate production secrets" && git push`

---

## What to do if a secret leaks

1. **Within minutes:** revoke the leaked secret in the appropriate console (links in the table above).
2. **Generate a replacement** using the same procedure as initial setup.
3. **Update Vercel** Environment Variables.
4. **Redeploy**: empty commit + push, or hit Redeploy in the Vercel dashboard.
5. **Audit:** check the service's logs for any suspicious activity since the leak time.
   - Neon: console → Branches → restore to a moment before the leak if needed
   - Vercel: Functions → Logs
   - Brevo: Statistics → Transactional history (look for sends you didn't initiate)
   - Upstash: console → Metrics

Worst-case database compromise: restore Neon to a pre-leak point-in-time, rotate all DB secrets, audit `audit_logs` for unauthorised actions, notify affected users.

---

## Demo credentials (safe to share)

For the supervisor's review and the demo video, these are the **non-rotatable** facts:

| | |
|---|---|
| Email | `saanvi.vishal@iiitb.ac.in` |
| Password | `cyberscore-demo-2026` |
| Org | IIIT Bangalore (Banking industry, EXCEL framework, SOLO admin) |
| Demo APK URL | (see latest EAS build URL, regenerated per build) |

These credentials are intended for supervisor review only. After handover, regenerate the demo user with a different password, or delete it and let the supervisor register their own account.

To regenerate / reset the demo user against the live Neon DB:

```bash
cd apps/api
DATABASE_URL='postgresql://...pooler.../neondb?sslmode=require' \
DEMO_EMAIL='saanvi.vishal@iiitb.ac.in' \
DEMO_PASSWORD='NewStrongPassword!' \
  npx tsx scripts/seed-demo-user.ts
```

Idempotent, re-running just updates the password hash with the new value.