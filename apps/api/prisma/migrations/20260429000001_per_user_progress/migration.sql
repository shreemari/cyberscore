-- AssessmentProgress: org-keyed → (org, user)-keyed.
-- For ENTERPRISE orgs the old shape collapsed every employee's resume index
-- onto a single row. Same row would push Bob to question 11 just because
-- Alice answered ten this morning. Now each user gets their own row.

-- 1. Add the userId column nullable so we can backfill before tightening.
ALTER TABLE "assessment_progress" ADD COLUMN "userId" TEXT;

-- 2. Backfill: assign existing rows to the org's first ADMIN user. Pre-
--    enterprise the org always had exactly one admin, so this resolves
--    cleanly for SOLO data. For any orphan rows (admin deleted, weird
--    test data), step 4's NOT NULL will fail loudly and step 3 covers
--    the obvious case.
UPDATE "assessment_progress" ap
SET "userId" = (
  SELECT u.id FROM "users" u
  WHERE u."orgId" = ap."orgId"
    AND u."role" = 'ADMIN'
    AND u."deletedAt" IS NULL
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE ap."userId" IS NULL;

-- 3. Drop unrecoverable rows (org with no admin user — shouldn't happen,
--    but if it did the row is meaningless).
DELETE FROM "assessment_progress" WHERE "userId" IS NULL;

-- 4. Lock the column down.
ALTER TABLE "assessment_progress" ALTER COLUMN "userId" SET NOT NULL;

-- 5. Swap the unique constraint. Prisma named the old one
--    `assessment_progress_orgId_level_key`; tolerate either name.
ALTER TABLE "assessment_progress"
    DROP CONSTRAINT IF EXISTS "assessment_progress_orgId_level_key";
DROP INDEX IF EXISTS "assessment_progress_orgId_level_key";

CREATE UNIQUE INDEX "assessment_progress_orgId_userId_level_key"
    ON "assessment_progress" ("orgId", "userId", "level");

CREATE INDEX "assessment_progress_userId_idx"
    ON "assessment_progress" ("userId");

-- 6. Foreign key — cascade on user delete so removing a teammate cleans up.
ALTER TABLE "assessment_progress"
    ADD CONSTRAINT "assessment_progress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
