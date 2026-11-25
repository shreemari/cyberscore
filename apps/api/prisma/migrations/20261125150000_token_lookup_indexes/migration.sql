-- New tokens use indexed SHA-256 locators plus independent bcrypt verification.
-- Legacy tokens remain in the database with NULL locator but cannot be looked
-- up through the new constant-time endpoints; clients must sign in again.
ALTER TABLE "refresh_tokens" ADD COLUMN "lookupKey" VARCHAR(64);
ALTER TABLE "share_tokens" ADD COLUMN "lookupKey" VARCHAR(64);
CREATE UNIQUE INDEX "refresh_tokens_lookupKey_key" ON "refresh_tokens"("lookupKey");
CREATE UNIQUE INDEX "share_tokens_lookupKey_key" ON "share_tokens"("lookupKey");
