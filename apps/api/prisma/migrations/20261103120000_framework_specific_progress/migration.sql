-- Add framework-specific assessment progress.
-- Existing progress records remain EXCEL by default.

ALTER TABLE "assessment_progress"
ADD COLUMN "frameworkCode" "Framework" NOT NULL DEFAULT 'EXCEL';

DROP INDEX "assessment_progress_orgId_userId_level_key";

CREATE UNIQUE INDEX
"assessment_progress_orgId_userId_level_frameworkCode_key"
ON "assessment_progress"("orgId", "userId", "level", "frameworkCode");
