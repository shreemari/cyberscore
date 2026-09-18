#!/usr/bin/env bash
# CyMetric — one-shot local bootstrap.
#
# Idempotent: safe to re-run. It checks each step and skips work that's
# already done. On a fresh machine this takes ~3 minutes (mostly npm install).
#
# Prereqs (script will check + error early if any are missing):
#   - Node 20+
#   - npm 10.9+
#   - PostgreSQL 16 running locally on :5432
#   - Redis running locally on :6379
#
# On macOS, install missing services with:
#   brew install postgresql@16 redis
#   brew services start postgresql@16
#   brew services start redis

set -euo pipefail

# ────────────────────────────────────────────────────────────────
# Pretty output helpers
# ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'
step() { printf "\n${GREEN}==>${RESET} %s\n" "$1"; }
warn() { printf "${YELLOW}!! ${RESET}%s\n" "$1"; }
fail() { printf "${RED}xx ${RESET}%s\n" "$1" >&2; exit 1; }
dim()  { printf "${DIM}   %s${RESET}\n" "$1"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ────────────────────────────────────────────────────────────────
# 0. Prereq checks
# ────────────────────────────────────────────────────────────────
step "Checking prerequisites"

command -v node >/dev/null || fail "Node 20+ is required. Install from https://nodejs.org or via nvm."
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$NODE_MAJOR" -ge 20 ] || fail "Node 20+ required, found $(node -v)."
dim "Node $(node -v)"

command -v npm >/dev/null || fail "npm is required."
dim "npm $(npm -v)"

# Postgres reachability — check that we can connect on the default port.
if ! (echo > /dev/tcp/localhost/5432) 2>/dev/null; then
  fail "Postgres is not reachable on localhost:5432. Start it with: brew services start postgresql@16"
fi
dim "Postgres reachable on :5432"

if ! (echo > /dev/tcp/localhost/6379) 2>/dev/null; then
  fail "Redis is not reachable on localhost:6379. Start it with: brew services start redis"
fi
dim "Redis reachable on :6379"

# ────────────────────────────────────────────────────────────────
# 1. Install workspace dependencies
# ────────────────────────────────────────────────────────────────
step "Installing dependencies (this can take 1–3 minutes the first time)"
if [ -d node_modules ] && [ -f node_modules/.package-lock.json ]; then
  dim "node_modules looks current — running 'npm install' to catch any drift"
fi
npm install

# ────────────────────────────────────────────────────────────────
# 2. .env files
# ────────────────────────────────────────────────────────────────
step "Setting up environment variables"

API_ENV="apps/api/.env"
if [ -f "$API_ENV" ]; then
  dim "$API_ENV already exists — leaving as-is"
else
  cp .env.example "$API_ENV"
  dim "Created $API_ENV from .env.example"
  warn "Open $API_ENV and fill in:"
  warn "  ANTHROPIC_API_KEY (required for AI chat — get at console.anthropic.com)"
  warn "  JWT_SECRET + REFRESH_TOKEN_SECRET (regenerate with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\")"
  warn "  Other vars are fine at their defaults for local dev"
fi

# ────────────────────────────────────────────────────────────────
# 3. Database — create + migrate + seed
# ────────────────────────────────────────────────────────────────
step "Setting up the database"

# Try to create the database; ignore if it already exists.
if createdb cymetric 2>/dev/null; then
  dim "Created database 'cymetric'"
else
  dim "Database 'cymetric' already exists — continuing"
fi

step "Applying Prisma migrations"
(cd apps/api && npx prisma migrate deploy)

step "Generating Prisma client"
(cd apps/api && npx prisma generate)

step "Seeding the KPI catalogue (46 KPIs / 212 tiers / 92 suggestions)"
(cd apps/api && npm run db:seed)

# ────────────────────────────────────────────────────────────────
# 4. Sanity check — typecheck across the monorepo
# ────────────────────────────────────────────────────────────────
step "Running typecheck (4 pre-existing errors expected — see docs/known-issues.md)"
npx turbo run typecheck || true

# ────────────────────────────────────────────────────────────────
# Done
# ────────────────────────────────────────────────────────────────
step "Setup complete"
cat <<'EOF'

Next steps — start the stack in three terminals:

  Tab 1 (API):
    npm run dev --workspace @cymetric/api

  Tab 2 (Workers):
    npm run worker --workspace @cymetric/api

  Tab 3 (Mobile):
    EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):3000 \
      npm run start --workspace @cymetric/mobile

  Then press 'i' in the Metro terminal to open the iOS Simulator,
  or scan the QR code with Expo Go on your phone.

  Test account (after seed): saanvi.vishal@iiitb.ac.in
  Use the in-app "Forgot?" flow to set a password — dev mode
  shows the OTP inline on the next screen.

Full docs: README.md → docs/
EOF
