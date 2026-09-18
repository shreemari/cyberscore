-- Clean orphaned references first. Old `responses` rows can carry
-- `matchedTierId` values that point at tier rows recreated by re-seeding,
-- so the FK can't be added without first nulling the stale ones.
UPDATE "responses" r
SET "matchedTierId" = NULL
WHERE r."matchedTierId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "scoring_tiers" t WHERE t.id = r."matchedTierId"
  );

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_matchedTierId_fkey" FOREIGN KEY ("matchedTierId") REFERENCES "scoring_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
