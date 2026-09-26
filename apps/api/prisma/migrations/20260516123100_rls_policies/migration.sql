-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security policies — tenant isolation at the DB layer.
--
-- Every tenant-scoped table gets:
--   • ENABLE ROW LEVEL SECURITY
--   • FORCE ROW LEVEL SECURITY (so superuser is also restricted — important
--     because Prisma connects as a superuser-equivalent in most setups)
--   • A USING policy keyed on current_setting('app.current_org_id')
--   • A WITH CHECK policy keyed on the same
--
-- The application reads/writes via two helpers in src/lib/prisma.ts:
--   withTenant(orgId, fn)  — SET LOCAL app.current_org_id = orgId
--   withBypassRls(fn)      — SET LOCAL app.bypass_rls = 'on'  (only for
--                            system ops: registration before the org exists,
--                            worker sweeps, the JWT verifier looking up
--                            users by token, etc.)
--
-- All policies honour the bypass flag so withBypassRls() still works.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: returns the current org_id from the session var, or NULL if unset.
-- Wrapped in a function so we can override behaviour without rewriting every
-- policy.
CREATE OR REPLACE FUNCTION current_org_id() RETURNS TEXT
LANGUAGE SQL STABLE AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '');
$$;

-- Helper: returns true when the session has set the bypass flag.
CREATE OR REPLACE FUNCTION rls_bypass() RETURNS BOOLEAN
LANGUAGE SQL STABLE AS $$
  SELECT COALESCE(current_setting('app.bypass_rls', true), 'off') = 'on';
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- organisations — special: rows ARE the tenant. A user can only see their
-- own org row. Bypass is required for registration (before the row exists)
-- and for admin impersonation.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations FORCE ROW LEVEL SECURITY;
CREATE POLICY org_self_access ON organisations
  USING (rls_bypass() OR id = current_org_id())
  WITH CHECK (rls_bypass() OR id = current_org_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- users — same as organisations, but bypass also covers login (where we
-- look up by email before the org context is known).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY user_tenant_isolation ON users
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- All other tenant-scoped tables get a uniform tenant-isolation policy.
-- ─────────────────────────────────────────────────────────────────────────────

-- refresh_tokens
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY rt_tenant_isolation ON refresh_tokens
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- invites
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites FORCE ROW LEVEL SECURITY;
CREATE POLICY invites_tenant_isolation ON invites
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- otp_verifications — keyed on email, not orgId. Bypass is required for
-- registration and password reset (org context unknown at that point).
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_verifications FORCE ROW LEVEL SECURITY;
CREATE POLICY otp_bypass_only ON otp_verifications
  USING (rls_bypass())
  WITH CHECK (rls_bypass());

-- responses
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses FORCE ROW LEVEL SECURITY;
CREATE POLICY responses_tenant_isolation ON responses
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- scorecard_snapshots
ALTER TABLE scorecard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY snapshots_tenant_isolation ON scorecard_snapshots
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- evidence_attachments
ALTER TABLE evidence_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY evidence_tenant_isolation ON evidence_attachments
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- assessment_progress
ALTER TABLE assessment_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_progress FORCE ROW LEVEL SECURITY;
CREATE POLICY progress_tenant_isolation ON assessment_progress
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY notifications_tenant_isolation ON notifications
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- push_tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY pushtokens_tenant_isolation ON push_tokens
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- share_tokens
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY share_tenant_isolation ON share_tokens
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- ai_usage
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_tenant_isolation ON ai_usage
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- audit_logs — readable by tenant, but inserts must allow NULL orgId for
-- system events (e.g. failed login attempts before org context exists).
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_tenant_read ON audit_logs FOR SELECT
  USING (rls_bypass() OR "orgId" = current_org_id());
CREATE POLICY audit_tenant_insert ON audit_logs FOR INSERT
  WITH CHECK (rls_bypass() OR "orgId" IS NULL OR "orgId" = current_org_id());

-- subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY subs_tenant_isolation ON subscriptions
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY apikey_tenant_isolation ON api_keys
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- webhooks
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks FORCE ROW LEVEL SECURITY;
CREATE POLICY wh_tenant_isolation ON webhooks
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- chat_threads
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads FORCE ROW LEVEL SECURITY;
CREATE POLICY chat_threads_tenant_isolation ON chat_threads
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());

-- chat_messages — joined via threadId; visibility follows the parent thread.
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_tenant_isolation ON chat_messages
  USING (
    rls_bypass()
    OR EXISTS (
      SELECT 1 FROM chat_threads t
      WHERE t.id = chat_messages."threadId"
      AND t."orgId" = current_org_id()
    )
  )
  WITH CHECK (
    rls_bypass()
    OR EXISTS (
      SELECT 1 FROM chat_threads t
      WHERE t.id = chat_messages."threadId"
      AND t."orgId" = current_org_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- KPI catalogue tables are intentionally NOT under RLS — they're shared
-- across all tenants (the same 46 KPIs serve every org). Same for
-- scoring_tiers, kpi_versions, kpi_suggestions, industry_benchmarks.
-- ─────────────────────────────────────────────────────────────────────────────
