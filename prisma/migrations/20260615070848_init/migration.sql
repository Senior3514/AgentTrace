-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('ORG', 'TEAM', 'USER', 'SERVICE');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'FINALIZED', 'FAILED', 'ABORTED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('AGENT', 'HUMAN', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "ActionClass" AS ENUM ('READ', 'WRITE', 'EXTERNAL_CALL', 'CODE_EXECUTION', 'SECRET_ACCESS', 'APPROVAL', 'CONTROL', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'ESCALATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApproverType" AS ENUM ('HUMAN', 'POLICY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('FILE', 'DIFF', 'LOG', 'OUTPUT', 'SCREENSHOT', 'DATASET', 'OTHER');

-- CreateEnum
CREATE TYPE "AttestationType" AS ENUM ('RECEIPT', 'IDENTITY', 'POLICY_BINDING', 'CUSTOM');

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "type" "OwnerType" NOT NULL DEFAULT 'ORG',
    "name" TEXT NOT NULL,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "framework" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1',
    "policyText" TEXT NOT NULL,
    "policyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "runExternalId" TEXT,
    "parentRunId" TEXT,
    "policyId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "riskLevel" "RiskLevel",
    "receiptHash" TEXT,
    "receiptSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "seqNo" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL DEFAULT 'AGENT',
    "actorId" TEXT,
    "toolName" TEXT,
    "targetSystem" TEXT,
    "actionClass" "ActionClass" NOT NULL DEFAULT 'OTHER',
    "mutatesState" BOOLEAN NOT NULL DEFAULT false,
    "irreversible" BOOLEAN NOT NULL DEFAULT false,
    "inputHash" TEXT,
    "outputHash" TEXT,
    "prevEventHash" TEXT,
    "eventHash" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "eventId" TEXT,
    "approverType" "ApproverType" NOT NULL DEFAULT 'HUMAN',
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "reason" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "eventId" TEXT,
    "artifactType" "ArtifactType" NOT NULL DEFAULT 'OTHER',
    "uri" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "contentPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attestations" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "attestationType" "AttestationType" NOT NULL DEFAULT 'CUSTOM',
    "subject" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "evidenceRef" TEXT,
    "signedBy" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_flags" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "eventId" TEXT,
    "flagType" TEXT NOT NULL,
    "severity" "RiskSeverity" NOT NULL DEFAULT 'LOW',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_externalId_key" ON "agents"("externalId");

-- CreateIndex
CREATE INDEX "agents_ownerId_idx" ON "agents"("ownerId");

-- CreateIndex
CREATE INDEX "policies_ownerId_idx" ON "policies"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "policies_ownerId_name_version_key" ON "policies"("ownerId", "name", "version");

-- CreateIndex
CREATE INDEX "runs_agentId_idx" ON "runs"("agentId");

-- CreateIndex
CREATE INDEX "runs_status_idx" ON "runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "runs_agentId_runExternalId_key" ON "runs"("agentId", "runExternalId");

-- CreateIndex
CREATE INDEX "events_runId_idx" ON "events"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "events_runId_seqNo_key" ON "events"("runId", "seqNo");

-- CreateIndex
CREATE INDEX "approvals_runId_idx" ON "approvals"("runId");

-- CreateIndex
CREATE INDEX "artifacts_runId_idx" ON "artifacts"("runId");

-- CreateIndex
CREATE INDEX "attestations_runId_idx" ON "attestations"("runId");

-- CreateIndex
CREATE INDEX "risk_flags_runId_idx" ON "risk_flags"("runId");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
