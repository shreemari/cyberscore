-- Nullable by design: do not invent organisation-specific measure metadata or
-- activate must-pass controls without an approved threshold.
ALTER TABLE "kpis"
  ADD COLUMN "measureOwner" VARCHAR(200),
  ADD COLUMN "measureSource" VARCHAR(500),
  ADD COLUMN "measureFrequency" VARCHAR(100),
  ADD COLUMN "measureTarget" VARCHAR(200),
  ADD COLUMN "measureFormula" TEXT,
  ADD COLUMN "criticalGateMinScorePct" INTEGER;

ALTER TABLE "kpis"
  ADD CONSTRAINT "kpis_critical_gate_pct_check"
  CHECK ("criticalGateMinScorePct" IS NULL OR
         "criticalGateMinScorePct" BETWEEN 0 AND 100);
