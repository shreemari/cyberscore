-- Enterprise mode: multi-user organisations with admin/employee roles.
-- Adds org.mode, joinMode, emailDomain, frameworkLocked; new Invite table;
-- KPI.answerScope; Response unique constraint moves to (orgId, kpiId, submittedById).

-- CreateEnum
CREATE TYPE "OrgMode" AS ENUM ('SOLO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "JoinMode" AS ENUM ('INVITE_ONLY', 'DOMAIN_AUTO', 'BOTH');

-- CreateEnum
CREATE TYPE "AnswerScope" AS ENUM ('ORG', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- AlterTable: organisations — add enterprise-mode fields
ALTER TABLE "organisations"
    ADD COLUMN "mode"            "OrgMode"  NOT NULL DEFAULT 'SOLO',
    ADD COLUMN "emailDomain"     VARCHAR(253),
    ADD COLUMN "joinMode"        "JoinMode" NOT NULL DEFAULT 'INVITE_ONLY',
    ADD COLUMN "frameworkLocked" BOOLEAN    NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "organisations_emailDomain_key" ON "organisations"("emailDomain");
CREATE INDEX "organisations_mode_idx" ON "organisations"("mode");

-- AlterTable: users — index for fast role lookups within an org
CREATE INDEX "users_orgId_role_idx" ON "users"("orgId", "role");

-- AlterTable: kpis — answerScope (ORG default keeps existing behaviour)
ALTER TABLE "kpis"
    ADD COLUMN "answerScope" "AnswerScope" NOT NULL DEFAULT 'ORG';

-- AlterTable: responses — drop single-response-per-org-per-kpi, add per-user uniqueness.
-- The old constraint name from Prisma's init migration is "responses_orgId_kpiId_key".
ALTER TABLE "responses" DROP CONSTRAINT IF EXISTS "responses_orgId_kpiId_key";
DROP INDEX IF EXISTS "responses_orgId_kpiId_key";

CREATE UNIQUE INDEX "responses_org_kpi_user_unique"
    ON "responses"("orgId", "kpiId", "submittedById");

CREATE INDEX "responses_submittedById_idx" ON "responses"("submittedById");

-- CreateTable: invites
CREATE TABLE "invites" (
    "id"           TEXT          NOT NULL,
    "orgId"        TEXT          NOT NULL,
    "email"        VARCHAR(254)  NOT NULL,
    "role"         "Role"        NOT NULL DEFAULT 'EMPLOYEE',
    "tokenHash"    TEXT          NOT NULL,
    "status"       "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById"  TEXT,
    "acceptedById" TEXT,
    "expiresAt"    TIMESTAMP(3)  NOT NULL,
    "acceptedAt"   TIMESTAMP(3),
    "revokedAt"    TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invites_tokenHash_key" ON "invites"("tokenHash");
CREATE INDEX "invites_orgId_idx"     ON "invites"("orgId");
CREATE INDEX "invites_email_idx"     ON "invites"("email");
CREATE INDEX "invites_tokenHash_idx" ON "invites"("tokenHash");
CREATE INDEX "invites_status_idx"    ON "invites"("status");
CREATE INDEX "invites_expiresAt_idx" ON "invites"("expiresAt");

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organisations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invites" ADD CONSTRAINT "invites_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invites" ADD CONSTRAINT "invites_acceptedById_fkey"
    FOREIGN KEY ("acceptedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS for invites lives in prisma/rls/rls.sql alongside every other
-- tenant-scoped table. Re-apply that file with psql after running this
-- migration. Keeping the policy out of the migration avoids the shadow-db
-- needing the app_bypass_rls() / app_current_org_id() helpers Prisma
-- doesn't know about during diff validation.
