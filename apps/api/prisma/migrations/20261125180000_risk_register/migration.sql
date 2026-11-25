CREATE TABLE "risk_records" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "likelihood" INTEGER NOT NULL,
  "impact" INTEGER NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  "treatment" VARCHAR(32) NOT NULL DEFAULT 'MITIGATE',
  "ownerId" TEXT,
  "dueDate" TIMESTAMP(3),
  "exceptionReason" TEXT,
  "acceptedUntil" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "risk_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "risk_records_valid_scale" CHECK ("likelihood" BETWEEN 1 AND 5 AND "impact" BETWEEN 1 AND 5 AND "riskScore" = "likelihood" * "impact"),
  CONSTRAINT "risk_records_acceptance_reason" CHECK ("treatment" <> 'ACCEPT' OR ("exceptionReason" IS NOT NULL AND length(trim("exceptionReason")) >= 10 AND "acceptedUntil" IS NOT NULL))
);

CREATE INDEX "risk_records_orgId_status_dueDate_idx" ON "risk_records"("orgId", "status", "dueDate");
CREATE INDEX "risk_records_orgId_riskScore_idx" ON "risk_records"("orgId", "riskScore");
ALTER TABLE "risk_records" ADD CONSTRAINT "risk_records_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "risk_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "risk_records_tenant_isolation" ON "risk_records"
  USING (rls_bypass() OR "orgId" = current_org_id())
  WITH CHECK (rls_bypass() OR "orgId" = current_org_id());
