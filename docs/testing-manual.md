# Manual Test Plan

A scripted set of manual tests to run before each release. Substitute for the automated test suite that hasn't been written yet.

> The next batch should replace this document with `*.test.ts` files. Manual testing is slow, flaky, and doesn't run on CI. But until tests exist, **this is the verification gate before a release.**

---

## When to run this

- Before tagging a new version
- Before sending a deployment URL to the supervisor / a user
- After any change to `lib/auth`, `lib/scorecard`, `lib/access`, or the mobile auth screens
- After a database migration
- After changing the email send code path

---

## Setup

You'll need:

1. **Local dev environment** running:
   ```bash
 # Terminal 1, API
   npm run dev --workspace @cymetric/api
   
 # Terminal 2, Mobile (Metro)
   EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):3000 \
     npm run start --workspace @cymetric/mobile
   ```
   *(Skip the worker terminal, emails are inline now.)*

2. **Or the live production deployment** at https://cyberscore-api.vercel.app, when testing the deployed APK or doing pre-handover smoke tests.

3. **A clean database** (if testing the register flow). Recreate with:
   ```bash
   cd apps/api && npx prisma migrate reset --force && npm run db:seed
   ```

---

## Smoke test (5 minutes, run before every demo)

The minimum verification that the app is functional.

| Step | Action | Expected | Pass? |
|---|---|---|---|
| 1 | Open the mobile app | Onboarding carousel appears, 3 slides | ⬜ |
| 2 | Tap **Skip** | Lands on Login screen | ⬜ |
| 3 | Enter `saanvi.vishal@iiitb.ac.in` / `cyberscore-demo-2026`, tap Login | Dashboard appears within 2 sec |⬜ |
| 4 | Dashboard shows score ring, level tiles | Numeric scores visible (not ""), tiles show RED/AMBER/GREEN | ⬜ |
| 5 | Tap **Assessment** | Level picker shows PEOPLE / PROCESS / COMPANY | ⬜ |
| 6 | Pick PEOPLE | First KPI question loads | ⬜ |
| 7 | Pick an answer, tap **Next** | Transitions to next KPI within 2 sec | ⬜ |
| 8 | Tap back to dashboard | Score may have updated | ⬜ |
| 9 | Tap **Insights** (chat) | Chat screen loads with suggested prompts | ⬜ |
| 10 | Tap "Where am I weakest?" suggestion | Streaming reply appears within 3 sec | ⬜ |
| 11 | Reply mentions specific KPIs by name | Done (advisor is grounded in real data) | ⬜ |
| 12 | Tap **Profile** | Profile screen loads with user info | ⬜ |
| 13 | Tap **Log out** | Returns to Login screen | ⬜ |

If any step fails → block the release.

---

## Full regression test (30 minutes)

Comprehensive coverage of all major flows. Run before tagging a release.

### A. Register (SOLO mode)

| Step | Action | Expected |
|---|---|---|
| A1 | Tap **Register** on login screen | Register form loads |
| A2 | Pick **SOLO** mode | Solo-specific fields appear |
| A3 | Enter name, email (use a unique test email), org name, industry, strong password | Form accepts input |
| A4 | Tap **Register** | OTP screen appears |
| A5 | Dev mode shows amber banner with OTP | Banner has 6-digit code |
| A6 | Tap to autofill, tap **Verify** | Lands on Dashboard |
| A7 | Dashboard shows fresh state (no assessment yet, score = 0) | All level tiles show "" or zero |

### B. Register (ENTERPRISE admin + invite employee)

| Step | Action | Expected |
|---|---|---|
| B1 | Register a new ENTERPRISE_ADMIN account | Same flow as A1-A6 but pick Enterprise Admin |
| B2 | Navigate to **Team** tab (admin only) | Team screen loads |
| B3 | Tap **Invite** | Invite form appears |
| B4 | Enter `employee+test@yourdomain.com`, role EMPLOYEE, check **PEOPLE** only | Form accepts input |
| B5 | Tap **Send invite** | Success message; invite row appears with status "pending" |
| B6 | If dev mode: token shown inline; if prod: check email | Token visible somewhere |
| B7 | Log out admin |
| B8 | Tap "Accept invite" link / paste token in accept-invite screen | Set password form appears |
| B9 | Set name + strong password | Lands on Dashboard |
| B10 | Assessment screen → only PEOPLE level shown (not PROCESS or COMPANY) | Level filter working |
| B11 | Tap COMPANY in URL bar (or via deep link) | 403 / redirected back |

### C. Assessment (full submission)

| Step | Action | Expected |
|---|---|---|
| C1 | Log in as SOLO admin / demo account | Dashboard |
| C2 | Tap Assessment → PEOPLE | First KPI question |
| C3 | Answer each KPI in PEOPLE level (5-10 KPIs) | Each Next-tap transitions within 2 sec |
| C4 | After last KPI, redirected to Results screen | Results page with PEOPLE score |
| C5 | Back to Assessment → PROCESS → answer all | Same |
| C6 | Same for COMPANY | Same |
| C7 | After all 3 levels done, Dashboard shows fully populated scorecard | Overall score visible, all level scores visible |
| C8 | Tap **Scorecard** | Per-KPI breakdown loads |
| C9 | Each KPI shows: tier match, score, RED/AMBER/GREEN band | All info visible |

### D. Scorecard recomputation

| Step | Action | Expected |
|---|---|---|
| D1 | From Scorecard screen, tap one KPI | Question opens for re-answer |
| D2 | Pick a different tier (worse or better) | Tier selected |
| D3 | Tap Save | Returns to scorecard |
| D4 | Scorecard reflects new score within 1 sec | Numbers updated |
| D5 | Dashboard overall score also updated | Recomputed |

### E. AI chat

| Step | Action | Expected |
|---|---|---|
| E1 | Tap Insights | Chat screen loads |
| E2 | Empty state shows 4 suggested prompts | All visible |
| E3 | Tap "Where am I weakest?" | Streaming reply, word-by-word |
| E4 | Reply mentions specific KPIs from the user's actual answers | Grounded in real data |
| E5 | Tap "How do I improve People?" | New reply, specific to People level |
| E6 | Type a custom question: "What's my biggest risk?" | Reply addresses overall weakness |
| E7 | Type a nonsense question: "asdfghjkl" | Falls through to "I can help with…" menu |
| E8 | Open thread drawer (left swipe or icon) | Shows past threads |
| E9 | Tap a past thread | Loads its history |
| E10 | Start a new thread (+ button) | Fresh empty state |

### F. Password reset

| Step | Action | Expected |
|---|---|---|
| F1 | Log out | Login screen |
| F2 | Tap **Forgot password?** | Forgot screen |
| F3 | Enter your real email | Form accepts |
| F4 | Tap Submit | OTP screen appears |
| F5 | **Check your real email inbox** | OTP email arrives within 30 sec (might be in Spam) |
| F6 | Email sender shows "CyMetric" | Done |
| F7 | Email subject: "Your CyMetric verification code" | Done |
| F8 | Email body contains 6-digit code | Done |
| F9 | Enter the OTP, tap Next | Set new password screen |
| F10 | Enter new password (8+ chars, mixed) | Form accepts |
| F11 | Tap Reset | Returns to login |
| F12 | Log in with new password | Dashboard |

**This is the most important E2E test**: it touches the full Brevo email pipeline.

### G. Framework switching (admin-only)

| Step | Action | Expected |
|---|---|---|
| G1 | As admin, go to Profile | Profile screen |
| G2 | Tap **Framework** | Framework picker (EXCEL / NIST / ISO) |
| G3 | Pick NIST CSF | Confirmation prompt |
| G4 | Confirm | Returns to Profile, framework shows NIST |
| G5 | Dashboard scorecard re-renders | KPI display updates to NIST control mapping |
| G6 | As employee (different account), Profile shows framework as locked | No edit option |

### H. TOTP 2FA setup + login

| Step | Action | Expected |
|---|---|---|
| H1 | Profile → Enable TOTP | QR code shown |
| H2 | Scan with Google Authenticator / Authy | App generates 6-digit codes |
| H3 | Enter current code, tap Verify | Success, TOTP enabled |
| H4 | Log out | |
| H5 | Log in with email + password | After password, TOTP prompt appears |
| H6 | Enter authenticator code | Lands on Dashboard |
| H7 | Profile → Disable TOTP → enter code | TOTP disabled |

*Only run this test if `TOTP_ENCRYPTION_KEY` is set in env. Otherwise H1 will error.*

### I. Personalised suggestions

| Step | Action | Expected |
|---|---|---|
| I1 | Answer a KPI with a low tier (e.g. "No MFA enforcement") | Suggestion appears on next render |
| I2 | Go to **Analytics** tab | Suggestions section shows underperforming KPIs |
| I3 | Each suggestion has a one-liner remediation | Text not empty |
| I4 | Tap a suggestion | Routes to the KPI question for re-answer |

### J. Token refresh + auto re-auth

| Step | Action | Expected |
|---|---|---|
| J1 | Log in normally | Dashboard |
| J2 | Wait 16 minutes (longer than JWT 15-min lifetime) | Token is now expired |
| J3 | Tap any screen that requires API | App refreshes JWT silently and shows screen |
| J4 | No login screen reappears | Refresh worked |

*Easier to test by manually expiring the token in SecureStore, long path otherwise.*

---

## Verifying the live deployment

Quick checks against `https://cyberscore-api.vercel.app` to confirm the production endpoint is healthy:

### Health check

```bash
curl -s https://cyberscore-api.vercel.app/api/v1/health | jq
```

Expected:
```json
{
  "ok": true,
  "uptimeMs": <some-large-number>,
  "latencyMs": { "database": <50-200>, "redis": <30-100> },
  "checks": { "database": "ok", "redis": "ok" }
}
```

### Login

```bash
curl -s -X POST 'https://cyberscore-api.vercel.app/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"saanvi.vishal@iiitb.ac.in","password":"cyberscore-demo-2026"}' \
  | jq '.user.email, .org.orgName'
```

Expected output:
```
"saanvi.vishal@iiitb.ac.in"
"IIIT Bangalore"
```

### Password reset OTP send

```bash
curl -s -X POST 'https://cyberscore-api.vercel.app/api/v1/auth/password-reset/request' \
  -H 'Content-Type: application/json' \
  -d '{"email":"saanvi.vishal@iiitb.ac.in"}' \
  -w '\n--- HTTP %{http_code} ---\n'
```

Expected:
```json
{"ok":true,"otpSent":true}
--- HTTP 200 ---
```

Then verify the email arrives in the IIITB inbox.

### Brevo log inspection (sanity check)

```bash
curl -s 'https://api.brevo.com/v3/smtp/emails?email=saanvi.vishal@iiitb.ac.in&limit=3' \
  -H 'api-key: <BREVO_API_KEY>' \
  -H 'accept: application/json' \
  | python3 -m json.tool
```

Should show recent sends from the API with `"subject": "Your CyMetric verification code"`.

---

## What's NOT covered by manual testing

- Race conditions (two users submitting the same KPI simultaneously)
- Concurrent assessment progress saves
- Edge cases in scoring (KPI with 0 weight, all-tier-1 responses)
- Memory leaks on long-running sessions
- Performance under load (1000+ concurrent users)

The next batch should write automated tests for these.

---

## When a manual test fails

1. **Capture:**
   - Screenshot of the broken screen
   - Network tab from Chrome dev tools (or React Native debugger) showing the failing request
   - API server logs from the same timestamp

2. **File:**
   - Open a GitHub issue with title `Bug: <one-line summary>`
   - Body: steps to reproduce, expected vs actual, screenshots, log excerpts
   - Label: `bug`

3. **Block:**
   - If a smoke-test step fails, block the release until fixed
   - If a regression-test step fails but smoke tests pass, document in `docs/known-issues.md` and decide whether to ship anyway