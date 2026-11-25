CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE "improvement_actions" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "kpiId" TEXT NOT NULL,
  "ownerId" TEXT,
  "dueDate" TIMESTAMP(3),
  "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "improvement_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "improvement_actions_orgId_kpiId_key" ON "improvement_actions"("orgId", "kpiId");
CREATE INDEX "improvement_actions_orgId_status_dueDate_idx" ON "improvement_actions"("orgId", "status", "dueDate");
ALTER TABLE "improvement_actions" ADD CONSTRAINT "improvement_actions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_actions" ADD CONSTRAINT "improvement_actions_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_actions" ADD CONSTRAINT "improvement_actions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Respect the existing tenant context used by withTenant().
ALTER TABLE "improvement_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "improvement_actions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "improvement_actions_tenant_isolation" ON "improvement_actions"
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());
