-- Daten-Backfill: KI-Readiness-Kampagne anlegen, Steps mit Templates verknüpfen,
-- bestehende Zielkunden der Kampagne zuordnen. Rein idempotent.

-- ─── 1) Default-Kampagne (KI Readiness Sprint) ──────────────────────────────
INSERT INTO "AcquisitionCampaign"
  ("id", "key", "name", "description", "pipelineId", "serviceId", "package",
   "startDate", "endDate", "active", "isDefault", "updatedAt")
SELECT
  'acq-campaign-ki-readiness',
  'ki-readiness',
  'KI Readiness Sprint',
  'KI-Readiness-Sprint – Standardkampagne auf der Haupt-Pipeline.',
  'acq-pipeline-main',
  (SELECT "id" FROM "ServiceCatalog" WHERE "name" ILIKE '%Readiness%' ORDER BY "id" LIMIT 1),
  NULL,
  (SELECT "startDate" FROM "AcquisitionSetting" WHERE "id" = 'singleton'),
  (SELECT "endDate" FROM "AcquisitionSetting" WHERE "id" = 'singleton'),
  true,
  true,
  CURRENT_TIMESTAMP
ON CONFLICT ("key") DO UPDATE
  SET "name" = EXCLUDED."name",
      "pipelineId" = EXCLUDED."pipelineId",
      "serviceId" = COALESCE("AcquisitionCampaign"."serviceId", EXCLUDED."serviceId"),
      "isDefault" = true,
      "updatedAt" = CURRENT_TIMESTAMP;

-- ─── 2) Steps mit Bibliotheks-Templates verknüpfen (Slug ↔ Template-Key) ────
UPDATE "AcquisitionPipelineStep" s
SET "templateId" = t."id"
FROM "AcquisitionStepTemplate" t
WHERE s."templateId" IS NULL AND t."key" = s."slug";

-- ─── 3) Bestehende Zielkunden der Kampagne zuordnen (Pipeline bleibt NULL) ──
UPDATE "AcquisitionTarget"
SET "campaignId" = 'acq-campaign-ki-readiness'
WHERE "campaignId" IS NULL;
