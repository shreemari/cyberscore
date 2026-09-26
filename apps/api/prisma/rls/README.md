# Row-Level Security

Applied as a raw SQL migration **after** `prisma migrate deploy`.

## Why it lives outside `migrations/` proper

Prisma Migrate owns the schema DDL. RLS policies reference column names (`"orgId"`) and change shape when we rename columns. Keeping them in a sibling folder lets us re-apply after every structural change without Prisma getting confused.

## Apply

```bash
cd apps/api
psql "$DIRECT_DATABASE_URL" -f prisma/migrations/rls/rls.sql
```

Wired into CI as:

```yaml
- run: npx prisma migrate deploy
- run: psql "$DIRECT_DATABASE_URL" -f prisma/migrations/rls/rls.sql
```

## How the app sets the tenant

Every API request opens a transaction in `lib/prisma.ts` and runs:

```sql
SET LOCAL app.current_org_id = 'clxyz...';
```

before any query. Worker jobs that need cross-tenant access set:

```sql
SET LOCAL app.bypass_rls = 'on';
```

Never grant `BYPASSRLS` to the app role. Bypass is controlled by session variables, which the app owns.

## Tables WITHOUT RLS

Global reference tables (shared across all tenants):

- `kpis`, `kpi_versions`, `scoring_tiers`, `kpi_suggestions`
- `industry_benchmarks`
- `otp_verifications` (scoped by email, not orgId — pre-login)

Writes to these are gated at the application layer by `role === 'ADMIN'`.
