-- ============================================================
-- CyMetric — Row-Level Security policies
-- ============================================================
-- Applied AFTER `prisma migrate deploy`. Defence-in-depth: even if
-- application-layer getAuthOrg() has a bug, Postgres will refuse to
-- return another tenant's rows.
--
-- How it works:
--   1. Every API request wraps its DB work in a transaction and runs
--      `SET LOCAL app.current_org_id = '<orgId>'` before any query.
--   2. Policies compare `current_setting('app.current_org_id', true)`
--      to the row's `orgId`. Mismatch = invisible.
--   3. Admin / system contexts set `app.bypass_rls = 'on'` — for
--      cross-tenant reports, seeding and worker jobs.
--
-- The Prisma connection user MUST NOT be a superuser or the table
-- owner, otherwise RLS is silently bypassed. Create a dedicated role:
--
--   CREATE ROLE cymetric_app LOGIN PASSWORD '...';
--   GRANT CONNECT ON DATABASE cymetric TO cymetric_app;
--   GRANT USAGE ON SCHEMA public TO cymetric_app;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES
--     IN SCHEMA public TO cymetric_app;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
--     TO cymetric_app;
--
-- Then set DATABASE_URL to use cymetric_app.

-- ------------------------------------------------------------
-- Helper: resolve current org id (NULL if unset)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_org_id()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')
$$;

CREATE OR REPLACE FUNCTION app_bypass_rls()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.bypass_rls', true), 'off') = 'on'
$$;

-- ------------------------------------------------------------
-- Enable RLS on tenant-scoped tables
-- ------------------------------------------------------------
ALTER TABLE organisations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_attachments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_progress     ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys                ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tokens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage                ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites                 ENABLE ROW LEVEL SECURITY;

-- Global (not tenant-scoped) tables — RLS stays OFF:
--   kpis, kpi_versions, scoring_tiers, kpi_suggestions,
--   industry_benchmarks, otp_verifications
-- These are globally readable by the app role. Writes are gated at the
-- application layer via role='ADMIN' checks.

-- ------------------------------------------------------------
-- Generic tenant isolation policy template
-- ------------------------------------------------------------
-- organisations: a row is visible only if its own id matches.
DROP POLICY IF EXISTS tenant_isolation ON organisations;
CREATE POLICY tenant_isolation ON organisations
  USING (app_bypass_rls() OR id = app_current_org_id())
  WITH CHECK (app_bypass_rls() OR id = app_current_org_id());

-- users / refresh_tokens / responses / snapshots / evidence /
-- progress / subs / api_keys / webhooks / notifications / push_tokens /
-- share_tokens / ai_usage — all scoped by orgId column.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users',
    'refresh_tokens',
    'responses',
    'scorecard_snapshots',
    'evidence_attachments',
    'assessment_progress',
    'subscriptions',
    'api_keys',
    'webhooks',
    'notifications',
    'push_tokens',
    'share_tokens',
    'ai_usage',
    'invites'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
        USING (app_bypass_rls() OR "orgId" = app_current_org_id())
        WITH CHECK (app_bypass_rls() OR "orgId" = app_current_org_id())
    $p$, t);
  END LOOP;
END$$;

-- ------------------------------------------------------------
-- audit_logs — append-only
-- ------------------------------------------------------------
-- Reads scoped to orgId, but NULL orgId (system events) only visible
-- under bypass.
DROP POLICY IF EXISTS audit_read ON audit_logs;
CREATE POLICY audit_read ON audit_logs
  FOR SELECT
  USING (
    app_bypass_rls()
    OR "orgId" = app_current_org_id()
  );

DROP POLICY IF EXISTS audit_insert ON audit_logs;
CREATE POLICY audit_insert ON audit_logs
  FOR INSERT
  WITH CHECK (
    app_bypass_rls()
    OR "orgId" = app_current_org_id()
    OR "orgId" IS NULL
  );

-- Trigger to forbid UPDATE and DELETE at the row level.
CREATE OR REPLACE FUNCTION forbid_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

-- ------------------------------------------------------------
-- Force RLS even for the table owner (safety belt)
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organisations','users','refresh_tokens','responses',
    'scorecard_snapshots','evidence_attachments','assessment_progress',
    'subscriptions','api_keys','webhooks','notifications','push_tokens',
    'share_tokens','ai_usage','audit_logs','invites'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END$$;
