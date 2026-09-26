-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Framework" AS ENUM ('EXCEL', 'NIST_CSF', 'ISO27001');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('PEOPLE', 'PROCESS', 'COMPANY');

-- CreateEnum
CREATE TYPE "InputType" AS ENUM ('PERCENTAGE', 'DROPDOWN', 'RADIO');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ScoreRange" AS ENUM ('RED', 'AMBER', 'GREEN');

-- CreateEnum
CREATE TYPE "SuggestionPriority" AS ENUM ('HIGH', 'MEDIUM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KpiStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "orgName" VARCHAR(200) NOT NULL,
    "industry" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "selectedFramework" "Framework" NOT NULL DEFAULT 'EXCEL',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" VARCHAR(512),
    "ipAddress" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "otpHash" TEXT NOT NULL,
    "purpose" VARCHAR(32) NOT NULL DEFAULT 'REGISTER',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpis" (
    "id" TEXT NOT NULL,
    "kpiName" VARCHAR(200) NOT NULL,
    "level" "Level" NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "weightage" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "inputType" "InputType" NOT NULL,
    "infoText" TEXT NOT NULL,
    "frameworkCode" "Framework" NOT NULL DEFAULT 'EXCEL',
    "nistControlIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isoControlIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "KpiStatus" NOT NULL DEFAULT 'PUBLISHED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_versions" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedById" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_tiers" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "tierLabel" VARCHAR(200) NOT NULL,
    "condition" JSONB NOT NULL,
    "scoreValue" INTEGER NOT NULL,
    "tierOrder" INTEGER NOT NULL,

    CONSTRAINT "scoring_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "kpiVersion" INTEGER NOT NULL,
    "submittedById" TEXT,
    "inputValue" VARCHAR(512) NOT NULL,
    "actualScore" INTEGER NOT NULL,
    "weightedScore" DOUBLE PRECISION NOT NULL,
    "matchedTierId" TEXT,
    "evidenceUrl" VARCHAR(1024),
    "naJustification" TEXT,
    "isNa" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_snapshots" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "peopleScore" DOUBLE PRECISION NOT NULL,
    "processScore" DOUBLE PRECISION NOT NULL,
    "companyScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "completeness" DOUBLE PRECISION NOT NULL,
    "feedbackText" TEXT,
    "breakdown" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorecard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_attachments" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "fileName" VARCHAR(255) NOT NULL,
    "fileKey" VARCHAR(512) NOT NULL,
    "fileUrl" VARCHAR(1024) NOT NULL,
    "fileType" VARCHAR(127) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_benchmarks" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "industry" VARCHAR(100) NOT NULL,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "topPercentileScore" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "source" VARCHAR(200) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "industry_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_suggestions" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "scoreRange" "ScoreRange" NOT NULL,
    "suggestionText" TEXT NOT NULL,
    "priority" "SuggestionPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_progress" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "lastQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "orgId" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(200) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(512),
    "traceId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "stripeCustomerId" VARCHAR(100),
    "stripeSubscriptionId" VARCHAR(100),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" VARCHAR(16) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "url" VARCHAR(1024) NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expoPushToken" VARCHAR(255) NOT NULL,
    "deviceId" VARCHAR(128) NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "appVersion" VARCHAR(32),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_tokens" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" VARCHAR(200),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "model" VARCHAR(64) NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisations_email_key" ON "organisations"("email");

-- CreateIndex
CREATE INDEX "organisations_email_idx" ON "organisations"("email");

-- CreateIndex
CREATE INDEX "organisations_industry_idx" ON "organisations"("industry");

-- CreateIndex
CREATE INDEX "organisations_deletedAt_idx" ON "organisations"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_orgId_idx" ON "users"("orgId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_orgId_idx" ON "refresh_tokens"("orgId");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "otp_verifications_email_idx" ON "otp_verifications"("email");

-- CreateIndex
CREATE INDEX "otp_verifications_expiresAt_idx" ON "otp_verifications"("expiresAt");

-- CreateIndex
CREATE INDEX "kpis_level_idx" ON "kpis"("level");

-- CreateIndex
CREATE INDEX "kpis_frameworkCode_idx" ON "kpis"("frameworkCode");

-- CreateIndex
CREATE INDEX "kpis_isActive_deletedAt_idx" ON "kpis"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "kpis_displayOrder_idx" ON "kpis"("displayOrder");

-- CreateIndex
CREATE INDEX "kpi_versions_kpiId_idx" ON "kpi_versions"("kpiId");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_versions_kpiId_version_key" ON "kpi_versions"("kpiId", "version");

-- CreateIndex
CREATE INDEX "scoring_tiers_kpiId_idx" ON "scoring_tiers"("kpiId");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_tiers_kpiId_tierOrder_key" ON "scoring_tiers"("kpiId", "tierOrder");

-- CreateIndex
CREATE INDEX "responses_orgId_idx" ON "responses"("orgId");

-- CreateIndex
CREATE INDEX "responses_kpiId_idx" ON "responses"("kpiId");

-- CreateIndex
CREATE INDEX "responses_submittedAt_idx" ON "responses"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "responses_orgId_kpiId_key" ON "responses"("orgId", "kpiId");

-- CreateIndex
CREATE UNIQUE INDEX "responses_org_idempotency_unique" ON "responses"("orgId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "scorecard_snapshots_orgId_generatedAt_idx" ON "scorecard_snapshots"("orgId", "generatedAt");

-- CreateIndex
CREATE INDEX "evidence_attachments_responseId_idx" ON "evidence_attachments"("responseId");

-- CreateIndex
CREATE INDEX "evidence_attachments_orgId_idx" ON "evidence_attachments"("orgId");

-- CreateIndex
CREATE INDEX "industry_benchmarks_industry_idx" ON "industry_benchmarks"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "industry_benchmarks_kpiId_industry_key" ON "industry_benchmarks"("kpiId", "industry");

-- CreateIndex
CREATE INDEX "kpi_suggestions_kpiId_scoreRange_idx" ON "kpi_suggestions"("kpiId", "scoreRange");

-- CreateIndex
CREATE INDEX "assessment_progress_orgId_idx" ON "assessment_progress"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_progress_orgId_level_key" ON "assessment_progress"("orgId", "level");

-- CreateIndex
CREATE INDEX "audit_logs_orgId_createdAt_idx" ON "audit_logs"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_orgId_key" ON "subscriptions"("orgId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_stripeSubscriptionId_idx" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_orgId_idx" ON "api_keys"("orgId");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "webhooks_orgId_idx" ON "webhooks"("orgId");

-- CreateIndex
CREATE INDEX "notifications_orgId_createdAt_idx" ON "notifications"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_orgId_isRead_idx" ON "notifications"("orgId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_expoPushToken_key" ON "push_tokens"("expoPushToken");

-- CreateIndex
CREATE INDEX "push_tokens_orgId_idx" ON "push_tokens"("orgId");

-- CreateIndex
CREATE INDEX "push_tokens_isActive_idx" ON "push_tokens"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_userId_deviceId_key" ON "push_tokens"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "share_tokens_tokenHash_key" ON "share_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "share_tokens_orgId_idx" ON "share_tokens"("orgId");

-- CreateIndex
CREATE INDEX "share_tokens_tokenHash_idx" ON "share_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "share_tokens_expiresAt_idx" ON "share_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "ai_usage_orgId_day_idx" ON "ai_usage"("orgId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_orgId_day_model_key" ON "ai_usage"("orgId", "day", "model");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_versions" ADD CONSTRAINT "kpi_versions_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_versions" ADD CONSTRAINT "kpi_versions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_tiers" ADD CONSTRAINT "scoring_tiers_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_snapshots" ADD CONSTRAINT "scorecard_snapshots_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_attachments" ADD CONSTRAINT "evidence_attachments_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_attachments" ADD CONSTRAINT "evidence_attachments_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_attachments" ADD CONSTRAINT "evidence_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industry_benchmarks" ADD CONSTRAINT "industry_benchmarks_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_suggestions" ADD CONSTRAINT "kpi_suggestions_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_progress" ADD CONSTRAINT "assessment_progress_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_tokens" ADD CONSTRAINT "share_tokens_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
