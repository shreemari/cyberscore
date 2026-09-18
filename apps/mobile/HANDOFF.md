# CyMetric Mobile — Handoff

A full snapshot of the app, architecture, recent design work, known gotchas, and pending tasks. If you open a fresh Claude session, point it at this file first.

---

## 1. What the app is

**CyMetric** — a React Native + Expo SDK 52 mobile app that scores a company's cyber resilience across three dimensions (People, Process, Company) via **46 KPIs**. Each KPI has 4 tier options mapped to NIST CSF 2.0 functions (PROTECT / DETECT / RESPOND / RECOVER / IDENTIFY / GOVERN).

- Users: single-org admins running a self-assessment
- Flow: onboarding → register → OTP verify → login → dashboard → pick level → answer 46 KPIs one at a time → results → scorecard / analytics
- Backend: Node/Fastify API with Postgres, JWT + refresh auth, Prisma
- Repo root: `/Users/saanvivishal/Desktop/cymetric`

---

## 2. Monorepo structure

```
cymetric/
├── apps/
│   ├── api/           # Fastify backend (runs on localhost:3000)
│   └── mobile/        # ← this is the app we've been working on
├── packages/
│   ├── sdk/           # Shared API client (@cymetric/sdk)
│   └── types/         # Shared TS types (@cymetric/types)
```

Inside `apps/mobile/`:

```
apps/mobile/
├── app/                          # expo-router file-based routes
│   ├── _layout.tsx               # Root: AuthGate, QueryClient, GestureHandler
│   ├── index.tsx                 # Splash redirect
│   ├── (auth)/
│   │   ├── _layout.tsx           # Stack
│   │   ├── onboarding.tsx        # First-open intro
│   │   ├── login.tsx             # Email/password + optional TOTP
│   │   ├── register.tsx          # Full registration w/ org + industry
│   │   ├── verify-otp.tsx        # 6-digit email OTP
│   │   └── forgot.tsx            # Password reset request
│   └── (app)/
│       ├── _layout.tsx           # Bottom tabs + hidden routes
│       ├── dashboard.tsx         # Home — score ring, level tiles, resume CTA
│       ├── assessment.tsx        # Level picker (hidden tab, reached from dashboard)
│       ├── kpi/[id].tsx          # Per-KPI question screen (hidden tab)
│       ├── results.tsx           # Assessment Complete screen (hidden tab)
│       ├── scorecard.tsx         # Full KPI breakdown
│       ├── analytics.tsx         # Trends, comparison, timeline
│       ├── chat.tsx              # AI advisor (stub)
│       └── profile.tsx           # User/org settings
├── src/
│   ├── components/               # Reusable UI
│   │   ├── Screen.tsx            # SafeArea + optional gradient glow wash
│   │   ├── TopBar.tsx            # Screen header with back chevron
│   │   ├── Card.tsx              # Glass BlurView card
│   │   ├── Button.tsx            # Primary/outline, loading, icon
│   │   ├── Input.tsx             # ⚠️ See §7 — has critical Bridgeless workaround
│   │   ├── SegmentedControl.tsx  # 7D/1M/1Y pill selector
│   │   ├── ScoreRing.tsx         # Circular score viz (SVG)
│   │   ├── BrandLogo.tsx         # CYBER//SCORE wordmark
│   │   └── PressableGlow.tsx     # Pressable with scale + glow
│   ├── lib/
│   │   ├── api.ts                # @cymetric/sdk wired with SecureStore
│   │   └── queryClient.ts        # TanStack Query config
│   ├── stores/
│   │   └── auth.ts               # Zustand auth store
│   ├── theme/
│   │   └── colors.ts             # Palette + scoreColorForValue()
│   └── styles/
│       └── global.css            # NativeWind Tailwind base
├── app.json                      # Expo config — newArchEnabled: false
├── HANDOFF.md                    # ← this file
└── package.json
```

---

## 3. Tech stack

| Layer | Tech |
|---|---|
| Framework | Expo SDK 52, React Native 0.76.9 |
| Routing | expo-router v4 (file-based, typed routes) |
| State | zustand (auth), TanStack Query v5 (server state) |
| Styling | NativeWind 4 (Tailwind for RN) + inline styles for dynamic values |
| Storage | expo-secure-store (JWT + refresh token) |
| Charts | react-native-svg (custom Path/Circle with LinearGradient) |
| Icons | @expo/vector-icons (Ionicons) |
| Effects | expo-blur (glassmorphism), expo-linear-gradient |
| API client | `@cymetric/sdk` workspace package (fetch wrapper with auto-refresh) |

---

## 4. Auth flow

Splash → `AuthGate` in `app/_layout.tsx` tries `api.auth.me()` with whatever tokens are in SecureStore. The SDK transparently refreshes expired JWTs. On failure, the store flips to `unauthenticated` and the AuthGate redirects to `(auth)/onboarding`.

```
app opens → AuthGate.useEffect → api.auth.me()
    success → setAuthenticated(me)  → redirect to /(app)/dashboard
    fail    → setUnauthenticated()  → redirect to /(auth)/onboarding
```

The routing effect watches `[status, segments]`:

```jsx
if (status === 'authenticated' && !inAppGroup)   → redirect /(app)/dashboard
if (status === 'unauthenticated' && !inAuthGroup) → redirect /(auth)/onboarding
```

**Critical**: the `!inAppGroup` check is what fixes root `/` redirection — before, it only checked `inAuthGroup` and got stuck when the user landed on `/`.

Login: email + password → POST /auth/login → if `AUTH_TOTP_REQUIRED` error, show TOTP input and re-submit. On success, fetch /me and navigate to dashboard.

Register: collects email, first/middle/surname, mobile, password, org name, industry. Combines first+middle+surname into `name` for the API. Redirects to `/verify-otp` with email param.

---

## 5. Design system — glassmorphism

The app uses restrained glassmorphism (not the earlier "cyberpunk HUD"). Rules:

- **Base**: `#05060d` — deep navy-black
- **Glass surface**: `rgba(255,255,255,0.03)` with `borderColor: rgba(255,255,255,0.06-0.08)` and a brighter `borderTopColor: rgba(255,255,255,0.14)` to simulate a lit-from-above top glint
- **One glow per screen** — `<Screen glow>` renders a soft blue→violet LinearGradient wash at top; don't stack them
- **Brand palette** (`src/theme/colors.ts`):
  - `brand[400]`: `#22d3ee` (cyan) — active state, accents
  - `brand[500]`: `#3b82f6` (blue) — borders, primary actions
  - `score.green`: `#10b981` — healthy, completed
  - `score.amber`: `#f59e0b` — warning
  - `score.red`: `#ef4444` — error, failing
- **Tonal tiles** (dashboard): People=brand blue, Process=amber, Company=green
- **Typography**: big bold numbers (`fontSize: 72` for scores), uppercase tracking-wide labels at `fontSize: 11, letterSpacing: 2`
- **Focus state**: brand blue border with subtle shadow bloom (but see §7 — applied via `setNativeProps`, not state)

---

## 6. What was built / redesigned in recent sessions

### New components
- `SegmentedControl.tsx` — full-width dark pill with active segment as a solid blue block; generic over `<T extends string>`

### New screens
- `results.tsx` — Assessment Complete screen:
  - Green checkmark with radial bloom
  - "Assessment Complete" heading + "Your cyber resilience profile is ready" subtitle
  - Three `ScoreCard` sub-components showing per-level scores with tonal glows (72px numbers)
  - "Download Executive PDF" + "Share with Board" buttons
  - Pill-style "← Back to Dashboard" button → `router.replace('/(app)/dashboard')`

### Rewritten screens
- `dashboard.tsx` — Tonal LevelTile cards with the 3 dimensions, Company card is full-width with SECURE pill + ANSWERED/TOTAL/SCORE stats, gradient-border RESUME ASSESSMENT pill
- `register.tsx` — Shield icon hero + CYMETRIC wordmark, glass card with LOGIN/REGISTER tabs, firstName/middleName/surname side-by-side row, mobile/password/orgName/industry chips
- `analytics.tsx` — "Performance Trends" heading, SegmentedControl (7D/1M/3M/6M/1Y), smooth bezier curve chart with gradient fill + y-gridlines, Category Comparison with previous (white/25%) + current (brand blue) bar pairs, Snapshot timeline with vertical connector line + dots + delta arrows
- `kpi/[id].tsx` — Custom header with back chevron + italic "CyMetric" wordmark + progress underline (blue bar), PROTECT framework pill with shield icon, green-glow-selected tier option rows with filled checkmark, sticky footer with PAUSE & SAVE (outline) + NEXT QUESTION (primary) — footer is OUTSIDE the ScrollView so it doesn't get cut off, navigates to `/(app)/results` on completion

### Layout updates
- `(app)/_layout.tsx` — hide internal routes from tab bar:
  ```jsx
  <Tabs.Screen name="assessment" options={{ href: null }} />
  <Tabs.Screen name="kpi/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
  <Tabs.Screen name="scorecard" options={{ href: null }} />
  <Tabs.Screen name="results" options={{ href: null, tabBarStyle: { display: 'none' } }} />
  ```
  `kpi/[id]` and `results` also hide the tab bar itself so the sticky footer/buttons aren't obscured.

### Card component
Rewrote to use `BlurView` with `rgba(255,255,255,0.06)` borders + brighter top glint. Optional tonal radial wash. Selected state with green halo.

---

## 7. ⚠️ CRITICAL GOTCHA — Bridgeless mode + TextInput focus

This cost hours to debug. **Read this before touching Input.tsx.**

### The bug
In Expo Go (which force-enables React Native's new architecture / Bridgeless mode regardless of `app.json`), if you have a TextInput inside a wrapper View whose **style changes when focus state flips**, the native view tree reshuffles on focus and the TextInput loses focus immediately. Symptom: tap email field → blue border flashes for one frame → keyboard appears for a millisecond → all gone. User can't type.

Symptoms you'll see if this regresses:
- Tap TextInput → cursor appears briefly → input blurs
- Metro log shows `[Input] FOCUS` immediately followed by `[Input] BLUR` with no user action
- No unmount — the component stays, it's just the native focus that's dropped

### The fix (in `src/components/Input.tsx`)
- **Do NOT** use `useState(focused)` + re-render to update wrapper styles on focus
- **DO** use `setNativeProps` via a ref to update the wrapper View's border imperatively:
  ```jsx
  const wrapRef = useRef<View>(null);
  const applyFocus = (on: boolean) => {
    wrapRef.current?.setNativeProps({
      style: {
        borderColor: on ? focusBorder : idleBorder,
        borderTopColor: on ? focusBorderTop : idleBorderTop,
      },
    });
  };
  // ... TextInput onFocus/onBlur call applyFocus(true/false)
  ```
- Ionicons does NOT support `setNativeProps` — leave the icon color static, don't try to animate it on focus (crashed with `this._icon.setNativeProps is not a function`)

### Related settings
- `app.json` has `"newArchEnabled": false` — ignored in Expo Go but takes effect in dev builds (see §10)
- ScrollView on auth screens uses `keyboardShouldPersistTaps="always"` (not `"handled"`)
- No `KeyboardAvoidingView` — replaced with `paddingTop` so the layout doesn't reflow when keyboard appears (that reflow was the secondary cause of keyboard flashing on login)

---

## 8. State stores

### Auth store (`src/stores/auth.ts`, zustand)
```ts
type Status = 'unknown' | 'authenticated' | 'unauthenticated';
{
  status: Status;
  user: User | null;
  setAuthenticated(user): void;
  setUnauthenticated(): void;
}
```

### TanStack Query
- `queryClient` in `src/lib/queryClient.ts`
- Key queries: `['progress']`, `['kpis', 'all']`, `['scorecard']`, `['snapshots']`
- Mutations invalidate `['progress']` and `['scorecard']` on answer save

---

## 9. Known issues / pending tasks

1. **Tab bar reconciliation** — original spec had 5 tabs (STATUS/THREATS/VAULT/SIGNALS/SYSTEM). Current implementation has 4 (STATUS/ANALYTICS/CHAT/PROFILE). Decide which and align. The reference mocks changed mid-stream; current 4-tab layout is the surviving version.
2. **Login screen design refresh** — the login screen was NOT rebuilt to match the latest glassmorphism reference. It still uses the older `bg-bg-card` + shadow shadow-cyan look. Register screen was rebuilt; login is now visually inconsistent with it.
3. **Chat screen is a stub** — placeholder UI only, no AI backend wired
4. **Remove debug logs** — I left `console.log('[AuthGate] ...')` calls in `app/_layout.tsx` for the earlier debugging. Safe to delete for production; keep for now while iterating.
5. **Icon color on focus** — Input icon stays gray on focus (the blue border + cursor are enough to signal focus, but if you want the icon to turn blue, you'd need to either (a) use an `Animated.Image` with native driver or (b) render the icon twice and toggle opacity via `setNativeProps` — don't use state, see §7)
6. **Dev build not yet created** — currently running in Expo Go. See §10 for when/why to move off.

---

## 10. Running the app

### Dev (Expo Go — current setup)
```bash
cd apps/api        # terminal 1
pnpm dev           # starts Fastify on :3000

cd apps/mobile     # terminal 2
npx expo start --clear
```
Scan QR with Expo Go on a real device, or press `i` for iOS simulator.

### Why you'll eventually need a dev build
Expo Go forces new architecture ON, which means:
- The Bridgeless bug workaround in §7 MUST stay in place as long as you use Expo Go
- Some native modules (notifications, deeper biometrics) aren't available in Expo Go
- Production builds will behave differently from Expo Go

When you're ready:
```bash
cd apps/mobile
npx expo prebuild --clean
npx expo run:ios       # or run:android
```
This generates a proper native app honoring `newArchEnabled: false`. First build takes ~5 min; subsequent builds are fast. Replaces Expo Go on your device/simulator.

### Common fixes
- **`ExpoBlur` native module not found** → `npx expo install expo-blur` (fixes SDK version mismatch)
- **Stuck on loading after login** → check AuthGate logs, usually means segments-based redirect missed a case
- **Keyboard flashing** → see §7, it's the Input component regression

---

## 11. API surface (backend contract)

All endpoints under `http://localhost:3000/api/v1`:

```
POST /auth/register          { orgName, industry, email, password, name }
POST /auth/verify-otp        { email, otp }
POST /auth/login             { email, password, totpCode? }
POST /auth/refresh           (uses refresh token from SecureStore)
GET  /auth/me                → User

GET  /kpis                   → { items: KPI[] }
GET  /progress               → { levels: [{ level, completionPct, lastQuestionIndex, status }] }
POST /kpis/:id/answer        { tierId }
GET  /scorecard              → full breakdown
GET  /scorecard/history      → historical snapshots
```

KPI levels: `'PEOPLE' | 'PROCESS' | 'COMPANY'`
KPI statuses: `'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'`

---

## 12. Debugging tips from this session

- **Metro log tagging** — when tracking focus/mount issues, add `console.log('[ComponentName] event', data)` with a bracketed tag so you can grep Metro output fast
- **AuthGate is the prime suspect** for navigation weirdness — it runs an effect on every `segments` change, and `segments` is a new array reference each render
- **Screen not scrollable** → ensure `<ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 140 }}>` — both flex AND padding matter, and enough bottom padding for tab bar + sticky footer
- **Simulator hardware keyboard** — Cmd+Shift+K toggles Connect Hardware Keyboard. If on, software keyboard flashes and auto-hides. NOT our bug — just a simulator setting.

---

## 13. Color reference (quick copy)

```ts
// src/theme/colors.ts
export const colors = {
  bg: { base: '#05060d', card: 'rgba(255,255,255,0.03)', elevated: 'rgba(255,255,255,0.06)' },
  brand: { 400: '#22d3ee', 500: '#3b82f6', 600: '#2563eb' },
  score: { green: '#10b981', amber: '#f59e0b', red: '#ef4444' },
  text: { primary: '#e5e7eb', secondary: '#9ca3af', muted: '#6b7280' },
  border: { subtle: 'rgba(255,255,255,0.06)', default: 'rgba(255,255,255,0.08)' },
};

export function scoreColorForValue(pct: number): string {
  if (pct >= 75) return colors.score.green;
  if (pct >= 50) return colors.brand[400];
  if (pct >= 25) return colors.score.amber;
  return colors.score.red;
}
```

---

## 14. If picking this up fresh

1. Read §7 (Bridgeless gotcha) before touching Input.tsx or TextInput anywhere
2. Read §4 (auth flow) before touching `_layout.tsx` or navigation
3. Check §9 (pending tasks) for what's half-done
4. Most screens follow the pattern: `<Screen glow>` → `<TopBar>` → `<ScrollView>` → content → optional sticky footer
5. When adding dynamic styles, prefer inline style objects; use NativeWind `className` for static layout (flex, padding, colors that don't change)
6. Always test in Expo Go AND remember that `newArchEnabled: false` is a no-op there

Good luck. The hardest parts (auth flow, keyboard bug, glass design system) are solved — it's 90% polish and wiring from here.
