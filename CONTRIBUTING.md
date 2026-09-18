# Contributing

Welcome. This doc covers how to work on CyMetric: branching, commits, PRs, and the local dev expectations. For *what* the codebase looks like, read [docs/architecture.md](docs/architecture.md).

## Setup (one time)

```bash
git clone <repo-url>
cd cymetric
./scripts/setup.sh        # installs deps, copies .env, runs migrations and seed
```

If the script does not work for you, [docs/database.md](docs/database.md) and [README.md](README.md) have the manual steps.

Confirm everything is wired:

```bash
npm run typecheck         # turbo runs typecheck across all workspaces
npm run lint              # turbo runs lint across all workspaces
```

## Running the project locally

In production we deploy only the API. There is no separate worker process running on Vercel. For local development you usually need two terminal tabs (sometimes three if you want the BullMQ workers running too):

```bash
# Tab 1: API (Next.js dev server on port 3000)
npm run dev --workspace @cymetric/api

# Tab 2: Mobile (Metro bundler plus Expo dev tools)
EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):3000 \
  npm run start --workspace @cymetric/mobile

# Tab 3 (optional): BullMQ workers (email, snapshot, push, abandonment)
# Email sending now happens inline through Brevo, so the worker is no
# longer required for the auth flow. Run it only if you are testing
# the snapshot or push or abandonment job paths.
npm run worker --workspace @cymetric/api
```

If your LAN IP changes (different network, hotel Wi-Fi, etc.), restart Metro with the new `EXPO_PUBLIC_API_URL`. The iOS Simulator and the Android emulator both reach the host through that LAN IP.

## Branching

The single long-lived branch is `main`. Everything else is short-lived.

| Branch type | Prefix | Lifetime |
|---|---|---|
| Feature work | `feat/<short-name>` | Hours to a few days |
| Bug fixes | `fix/<short-name>` | Hours |
| Documentation | `docs/<short-name>` | Hours |
| Chores or tooling | `chore/<short-name>` | Hours |
| Refactor (no behaviour change) | `refactor/<short-name>` | Days |
| Experimental spikes | `spike/<short-name>` | Disposable. Usually not merged. |

Examples:
- `feat/team-csv-export`
- `fix/login-rate-limit-key`
- `docs/onboarding-walkthrough`
- `chore/bump-expo-sdk-53`

**Never commit directly to `main`.** Every change goes through a PR. Even for solo work, the diff review forces a second look.

## Commits

Conventional Commits style. Subject line is **imperative present** ("add X", not "added X"). Keep it under 72 characters. Details go in the body.

```
<type>(<scope>): <subject>

<body. What changed and why, not how.>

<footer. For example "Closes #42".>
```

Types:
- `feat`. User-facing new capability.
- `fix`. Bug fix.
- `docs`. Documentation only.
- `refactor`. Code change that neither fixes a bug nor adds a feature.
- `perf`. Performance improvement.
- `test`. Adding or updating tests.
- `chore`. Tooling, deps, build. No source change.

Scopes (use one when it helps, skip when it does not):
- `api`, `mobile`, `sdk`, `types`, `db`, `infra`

Examples:

```
feat(mobile): add tap-to-autofill OTP banner in dev mode
fix(api): correct rate-limit key for password-reset endpoint
docs(architecture): explain RLS bypass pattern
refactor(api): extract scorecard aggregation into pure function
```

### What not to do in commits

- Do not commit `.env`. The gitignore already blocks it but double-check before pushing.
- Do not commit `node_modules`. Also gitignored.
- Do not commit `.DS_Store`, `*.log`, or IDE configs.
- Do not squash unrelated changes together. One logical change per commit. A 200-line PR with four commits beats a 200-line PR with one "stuff" commit.

## Pull requests

Open a PR even for small fixes. The PR description should answer three questions:

1. **What** does this change?
2. **Why** does it change it? (link to issue, spec, or chat thread)
3. **How** would a reviewer verify it works?

Template (copy this into the PR description):

```markdown
## What

<1 to 2 sentences>

## Why

<link to issue, or a short rationale>

## How to verify

- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] Manual check: <steps a reviewer can follow>

## Screenshots or demo

<for UI changes>

## Notes for reviewer

<anything subtle or controversial>
```

### Review etiquette

- **Reviewer's job:** look for correctness, security, and surprises. Style nits are fine but do not block on them. Approve with comments rather than request changes for purely cosmetic stuff.
- **Author's job:** respond to every comment, even with a quick "ack" if no change is needed. If you disagree, push back. Reviewers are not always right.
- **Merging:** the author merges after at least one approval. Use "Squash and merge" so `main` stays linear and readable.

## Code style

We are not strict about formatting because Prettier handles it. But:

- **TypeScript only.** No JavaScript files. A `*.js` in the repo is a linting failure waiting to happen.
- **No `any`.** If you need a fast escape hatch use `unknown` and narrow with a type guard. Strict mode will catch most cases anyway.
- **Comments explain *why*, not *what*.** The code already says what. Comments should say why this approach. Do not waste lines explaining what `useMemo` does.
- **Single export per route handler.** `export async function GET` etc. Do not colocate helper functions in route files. Move them to `lib/`.
- **Server-only helpers in `lib/`, shared types in `packages/types`.** If the mobile app needs a shape, it goes in `@cymetric/types` so both sides import the same source of truth.

## Database changes

Always through Prisma migrations:

```bash
cd apps/api
# Edit prisma/schema.prisma first.
npx prisma migrate dev --name what_changed
```

This creates a new folder in `prisma/migrations/` with the generated SQL file. Do not edit past migrations. Write a new one to fix mistakes.

Migrations are append-only and idempotent (`migrate deploy` skips already-applied ones). Never rebase migration commits out of `main` once they have been applied to a shared database, including Neon.

## Tests

There are no tests yet (see the "No tests" entry in [docs/known-issues.md](docs/known-issues.md)). The framework is wired up (`vitest` in the API workspace, `turbo run test` from root). You just need to add `*.test.ts` files next to the code they test:

```
apps/api/src/lib/scoring.test.ts
apps/api/src/lib/scorecard.test.ts
```

Aim for behaviour tests, not implementation tests. Mock Prisma sparingly. A real Postgres test database (via `pg-mem` locally or a Docker `postgres` service in CI) is preferable.

## Working with secrets

- `.env` is gitignored. Never commit it.
- The `.env.example` documents every variable. Update it when you add a new one.
- For production secrets, use the hosting provider's secret manager. For us that means Vercel Environment Variables.
- If you accidentally push a secret: **rotate it immediately**, then run `git filter-repo` (or BFG) to scrub history. Do not trust commit deletion alone, GitHub caches the blob for a while.

## Updating dependencies

- Patch and minor updates: open a `chore/deps-<date>` PR with the changes. Run lint, typecheck, and a manual sanity check.
- Major updates: one separate PR per major upgrade. Read the changelog before merging.
- Expo SDK upgrades: follow https://docs.expo.dev/upgrade. Never just bump the version number. Always run `npx expo install --fix` afterwards.

## Releasing

Each release is a Git tag of the form `vX.Y.Z`:

```bash
# After merging to main:
git checkout main && git pull
git tag -a v0.3.1 -m "v0.3.1: short summary of what changed"
git push --tags
```

Update `CHANGELOG.md` in the same commit that creates the tag. Add a new section for the new version with the date and a short summary, followed by Added, Changed, and Fixed subsections in that order.

## Asking for help

Stuck? Open a draft PR with what you have so far and ask in the description. Or open an issue with the question. A written question is easier for the next person to find than a chat message.

## Acknowledgements

CyMetric is a student project handed over from one IIIT Bangalore batch to the next. If you are picking it up: welcome. Read [docs/handover-notes.md](docs/handover-notes.md) and [docs/known-issues.md](docs/known-issues.md) before making changes. There is context in those files that is not obvious from the code alone.
