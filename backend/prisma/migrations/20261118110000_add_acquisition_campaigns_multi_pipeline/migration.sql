-- Mehrere Workflows (Pipelines) + Kampagnen.
-- Idempotent über IF NOT EXISTS / DO-Blöcke.

-- ─── 1) Kampagnen-Tabelle ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AcquisitionCampaign" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pipelineId" TEXT NOT NULL,
    "serviceId" TEXT,
    "package" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcquisitionCampaign_key_key" ON "AcquisitionCampaign"("key");
CREATE INDEX IF NOT EXISTS "AcquisitionCampaign_pipelineId_idx" ON "AcquisitionCampaign"("pipelineId");
CREATE INDEX IF NOT EXISTS "AcquisitionCampaign_serviceId_idx" ON "AcquisitionCampaign"("serviceId");

DO $$ BEGIN
  ALTER TABLE "AcquisitionCampaign" ADD CONSTRAINT "AcquisitionCampaign_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "AcquisitionPipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcquisitionCampaign" ADD CONSTRAINT "AcquisitionCampaign_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2) Pipeline: description + isDefault + ein Default ──────────────────────
ALTER TABLE "AcquisitionPipeline" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "AcquisitionPipeline" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "AcquisitionPipeline_single_default" ON "AcquisitionPipeline"((true)) WHERE "isDefault";

-- ─── 3) Steps: templateId + Eindeutigkeit pro Pipeline ──────────────────────
ALTER TABLE "AcquisitionPipelineStep" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
CREATE INDEX IF NOT EXISTS "AcquisitionPipelineStep_templateId_idx" ON "AcquisitionPipelineStep"("templateId");

DO $$ BEGIN
  ALTER TABLE "AcquisitionPipelineStep" ADD CONSTRAINT "AcquisitionPipelineStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AcquisitionStepTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP INDEX IF EXISTS "AcquisitionPipelineStep_status_key";
DROP INDEX IF EXISTS "AcquisitionPipelineStep_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "AcquisitionPipelineStep_pipelineId_status_key" ON "AcquisitionPipelineStep"("pipelineId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "AcquisitionPipelineStep_pipelineId_slug_key" ON "AcquisitionPipelineStep"("pipelineId", "slug");

-- ─── 4) Targets: campaignId + pipelineId ────────────────────────────────────
ALTER TABLE "AcquisitionTarget" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "AcquisitionTarget" ADD COLUMN IF NOT EXISTS "pipelineId" TEXT;
CREATE INDEX IF NOT EXISTS "AcquisitionTarget_campaignId_idx" ON "AcquisitionTarget"("campaignId");
CREATE INDEX IF NOT EXISTS "AcquisitionTarget_pipelineId_idx" ON "AcquisitionTarget"("pipelineId");

DO $$ BEGIN
  ALTER TABLE "AcquisitionTarget" ADD CONSTRAINT "AcquisitionTarget_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AcquisitionCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcquisitionTarget" ADD CONSTRAINT "AcquisitionTarget_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "AcquisitionPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 5) Bestehende Haupt-Pipeline als Default markieren ─────────────────────
UPDATE "AcquisitionPipeline" SET "isDefault" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'acq-pipeline-main';
