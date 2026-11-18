-- Definierbare Akquise-Pipeline: Tabellen + 1 Pipeline, 5 Stages, 17 Steps, 1 Transition.
-- Idempotent über IF NOT EXISTS / ON CONFLICT. Dieselben Rows legt prisma/seed-pipeline.js an.

-- ─── 1) Tabellen ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AcquisitionPipeline" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionPipeline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcquisitionPipelineStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionPipelineStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcquisitionPipelineStep" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shortLabel" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "activityType" TEXT,
    "title" TEXT,
    "description" TEXT,
    "requiredFields" JSONB,
    "isClosing" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT,
    "isWildcard" BOOLEAN NOT NULL DEFAULT false,
    "isInTalk" BOOLEAN NOT NULL DEFAULT false,
    "isOffer" BOOLEAN NOT NULL DEFAULT false,
    "isOfferSent" BOOLEAN NOT NULL DEFAULT false,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "isEarly" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionPipelineStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcquisitionPipelineTransition" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcquisitionPipelineTransition_pkey" PRIMARY KEY ("id")
);

-- ─── 2) Indizes ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "AcquisitionPipeline_key_key" ON "AcquisitionPipeline"("key");

CREATE UNIQUE INDEX IF NOT EXISTS "AcquisitionPipelineStage_pipelineId_key_key" ON "AcquisitionPipelineStage"("pipelineId", "key");
CREATE INDEX IF NOT EXISTS "AcquisitionPipelineStage_pipelineId_idx" ON "AcquisitionPipelineStage"("pipelineId");

CREATE UNIQUE INDEX IF NOT EXISTS "AcquisitionPipelineStep_status_key" ON "AcquisitionPipelineStep"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "AcquisitionPipelineStep_slug_key" ON "AcquisitionPipelineStep"("slug");
CREATE INDEX IF NOT EXISTS "AcquisitionPipelineStep_pipelineId_idx" ON "AcquisitionPipelineStep"("pipelineId");
CREATE INDEX IF NOT EXISTS "AcquisitionPipelineStep_stageId_idx" ON "AcquisitionPipelineStep"("stageId");

CREATE UNIQUE INDEX IF NOT EXISTS "AcquisitionPipelineTransition_pipelineId_fromStatus_toStatus_key" ON "AcquisitionPipelineTransition"("pipelineId", "fromStatus", "toStatus");
CREATE INDEX IF NOT EXISTS "AcquisitionPipelineTransition_pipelineId_idx" ON "AcquisitionPipelineTransition"("pipelineId");

-- ─── 3) Fremdschlüssel (nur anlegen, falls noch nicht vorhanden) ────────────
DO $$ BEGIN
  ALTER TABLE "AcquisitionPipelineStage" ADD CONSTRAINT "AcquisitionPipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "AcquisitionPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcquisitionPipelineStep" ADD CONSTRAINT "AcquisitionPipelineStep_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "AcquisitionPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcquisitionPipelineStep" ADD CONSTRAINT "AcquisitionPipelineStep_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "AcquisitionPipelineStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AcquisitionPipelineTransition" ADD CONSTRAINT "AcquisitionPipelineTransition_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "AcquisitionPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 4) Seed: Pipeline + Stages ─────────────────────────────────────────────
INSERT INTO "AcquisitionPipeline" ("id", "key", "name", "active", "updatedAt")
VALUES ('acq-pipeline-main', 'default', 'Akquise-Pipeline', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "name" = EXCLUDED."name", "active" = EXCLUDED."active", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "AcquisitionPipelineStage" ("id", "pipelineId", "key", "label", "order", "updatedAt")
VALUES
  ('acq-stage-lead',           'acq-pipeline-main', 'lead',           'Lead-Gewinnung', 1, CURRENT_TIMESTAMP),
  ('acq-stage-qualifizierung', 'acq-pipeline-main', 'qualifizierung', 'Qualifizierung', 2, CURRENT_TIMESTAMP),
  ('acq-stage-erstgespraech',  'acq-pipeline-main', 'erstgespraech',  'Erstgespräch',   3, CURRENT_TIMESTAMP),
  ('acq-stage-angebot',        'acq-pipeline-main', 'angebot',        'Angebot',        4, CURRENT_TIMESTAMP),
  ('acq-stage-abschluss',      'acq-pipeline-main', 'abschluss',      'Abschluss',      5, CURRENT_TIMESTAMP)
ON CONFLICT ("pipelineId", "key") DO UPDATE
  SET "label" = EXCLUDED."label", "order" = EXCLUDED."order", "updatedAt" = CURRENT_TIMESTAMP;

-- ─── 5) Seed: Steps ─────────────────────────────────────────────────────────
INSERT INTO "AcquisitionPipelineStep"
  ("id", "pipelineId", "stageId", "status", "slug", "label", "shortLabel", "order", "activityType",
   "title", "description", "requiredFields", "isClosing", "outcome", "isWildcard", "isInTalk",
   "isOffer", "isOfferSent", "isWon", "isLost", "isEarly", "active", "updatedAt")
VALUES
  ('acq-step-offen', 'acq-pipeline-main', 'acq-stage-lead', 'offen', 'offen', 'offen', 'offen', 1, 'Note',
   'Zielkunde anlegen', 'Neuen Zielkunden erfassen und der Akquise zuordnen.', '[]'::jsonb,
   false, NULL, false, false, false, false, false, false, true, true, CURRENT_TIMESTAMP),

  ('acq-step-recherchiert', 'acq-pipeline-main', 'acq-stage-lead', 'recherchiert', 'recherchiert', 'recherchiert', 'recherchiert', 2, 'Note',
   'Unternehmen recherchieren', 'Branche, Größe, KI-Initiativen und passende Entscheider recherchieren und erfassen.', '[]'::jsonb,
   false, NULL, false, false, false, false, false, false, true, true, CURRENT_TIMESTAMP),

  ('acq-step-vernetzt', 'acq-pipeline-main', 'acq-stage-lead', 'vernetzt', 'vernetzt', 'vernetzt', 'vernetzt', 3, 'Note',
   'Entscheider vernetzen', 'Ansprechpartner identifizieren und über LinkedIn oder das Netzwerk verbinden.', '[]'::jsonb,
   false, NULL, false, false, false, false, false, false, true, true, CURRENT_TIMESTAMP),

  ('acq-step-kontaktiert', 'acq-pipeline-main', 'acq-stage-lead', 'kontaktiert', 'kontaktiert', 'kontaktiert', 'kontaktiert', 4, 'Call',
   'Erstkontakt herstellen', 'Telefonisch oder per E-Mail kontaktieren – Anlass und Rechtsgrundlage nach § 7 UWG prüfen.', '[]'::jsonb,
   false, NULL, false, false, false, false, false, false, true, true, CURRENT_TIMESTAMP),

  ('acq-step-qualifizierungsgespraech', 'acq-pipeline-main', 'acq-stage-qualifizierung', 'Qualifizierungsgespräch', 'qualifizierungsgespraech', 'Qualifizierungsgespräch planen', 'Qualifizierungsgespräch', 5, 'Meeting',
   'Qualifizierungsgespräch planen', 'Termin mit dem Kunden abstimmen, Teilnehmer festlegen und im Kalender festhalten.',
   '[{"payload":"firstMeetingDate","label":"Termin Qualifizierungsgespräch","type":"date"}]'::jsonb,
   false, NULL, false, true, false, false, false, false, false, true, CURRENT_TIMESTAMP),

  ('acq-step-qualifizierungsgespraech-durchgefuehrt', 'acq-pipeline-main', 'acq-stage-qualifizierung', 'Qualifizierungsgespräch durchgeführt', 'qualifizierungsgespraech-durchgefuehrt', 'Qualifizierungsgespräch durchgeführt', 'Qualifizierungsgespräch durchgeführt', 6, 'Meeting',
   'Qualifizierungsgespräch durchführen', 'Bedarf, Budget, Zeitrahmen und Entscheiderstruktur klären und das Gespräch dokumentieren.',
   '[{"payload":"firstMeetingDate","label":"Datum Qualifizierungsgespräch","type":"date"}]'::jsonb,
   false, NULL, false, true, false, false, false, false, false, true, CURRENT_TIMESTAMP),

  ('acq-step-uebergabe-an-engagement-manager', 'acq-pipeline-main', 'acq-stage-qualifizierung', 'Übergabe an Engagement Manager', 'uebergabe-an-engagement-manager', 'Übergabe an EM', 'Übergabe an Engagement Manager', 7, 'Meeting',
   'An Engagement Manager übergeben', 'Kontext, Erkenntnisse und nächste Schritte vollständig an den EM übergeben.', '[]'::jsonb,
   false, NULL, false, true, false, false, false, false, false, true, CURRENT_TIMESTAMP),

  ('acq-step-erstgespraech-terminiert', 'acq-pipeline-main', 'acq-stage-erstgespraech', 'Erstgespräch terminiert', 'erstgespraech-terminiert', 'Erstgespräch geplant', 'Erstgespräch terminiert', 8, 'Meeting',
   'Erstgespräch planen', 'Termin mit dem Kunden abstimmen, Teilnehmer festlegen und im Kalender festhalten.',
   '[{"payload":"firstMeetingDate","label":"Termin Erstgespräch","type":"date"}]'::jsonb,
   false, NULL, false, true, false, false, false, false, false, true, CURRENT_TIMESTAMP),

  ('acq-step-erstgespraech-durchgefuehrt', 'acq-pipeline-main', 'acq-stage-erstgespraech', 'Erstgespräch durchgeführt', 'erstgespraech-durchgefuehrt', 'Erstgespräch durchgeführt', 'Erstgespräch durchgeführt', 9, 'Meeting',
   'Erstgespräch durchführen', 'Termin wahrnehmen, Ist-Situation aufnehmen und den Readiness-Fragebogen ankündigen.',
   '[{"payload":"firstMeetingDate","label":"Datum Erstgespräch","type":"date"}]'::jsonb,
   false, NULL, false, true, false, false, false, false, false, true, CURRENT_TIMESTAMP),

  ('acq-step-fragebogen-geschickt', 'acq-pipeline-main', 'acq-stage-erstgespraech', 'Fragebogen geschickt', 'fragebogen-geschickt', 'Fragebogen geschickt', 'Fragebogen geschickt', 10, 'Email',
   'Fragebogen senden', 'Readiness-Fragebogen an den Kunden senden und den Rücklauf nachhalten.', '[]'::jsonb,
   false, NULL, false, true, false, false, false, false, false, true, CURRENT_TIMESTAMP),

  ('acq-step-angebot-in-vorbereitung', 'acq-pipeline-main', 'acq-stage-angebot', 'Angebot in Vorbereitung', 'angebot-in-vorbereitung', 'Angebot in Vorbereitung', 'Angebot in Vorbereitung', 11, 'Note',
   'Angebot vorbereiten', 'Antworten auswerten, Use Cases ableiten und Paket, Leistungen und Preis zusammenstellen.',
   '[{"payload":"offerValue","label":"Erwarteter Angebotswert (€)","type":"number"}]'::jsonb,
   false, NULL, false, false, true, false, false, false, false, true, CURRENT_TIMESTAMP),

  ('acq-step-angebot-versendet', 'acq-pipeline-main', 'acq-stage-angebot', 'Angebot versendet', 'angebot-versendet', 'Angebot versendet', 'Angebot versendet', 12, 'Email',
   'Angebot versenden', 'Angebot finalisieren und an den Kunden senden.',
   '[{"payload":"offerValue","label":"Angebotswert (€)","type":"number"}]'::jsonb,
   false, NULL, false, false, true, true, false, false, false, true, CURRENT_TIMESTAMP),

  ('acq-step-nachverhandlung', 'acq-pipeline-main', 'acq-stage-angebot', 'Nachverhandlung', 'nachverhandlung', 'Nachverhandlung', 'Nachverhandlung', 13, 'Call',
   'Angebot nachfassen', 'Rückmeldung einholen, offene Fragen klären und Konditionen verhandeln.', '[]'::jsonb,
   false, NULL, false, false, true, true, false, false, false, true, CURRENT_TIMESTAMP),

  ('acq-step-gewonnen', 'acq-pipeline-main', 'acq-stage-abschluss', 'gewonnen', 'gewonnen', 'gewonnen', 'gewonnen', 14, 'Note',
   'Abschluss speichern', 'Kunde gewonnen: Account verknüpfen, Vertrag bzw. Projekt anlegen und an die Delivery übergeben.',
   '[{"payload":"decisionDate","label":"Entscheidungsdatum","type":"date"},{"payload":"offerValue","label":"Auftragswert (€)","type":"number"}]'::jsonb,
   true, 'won', false, false, false, false, true, false, false, true, CURRENT_TIMESTAMP),

  ('acq-step-folgeprojekt', 'acq-pipeline-main', 'acq-stage-abschluss', 'Folgeprojekt', 'folgeprojekt', 'Folgeprojekt', 'Folgeprojekt', 15, 'Note',
   'Folgeprojekt starten', 'Folgeprojekt anlegen und den Kick-off mit dem Kunden vereinbaren.', '[]'::jsonb,
   true, 'won', false, false, false, false, true, false, false, true, CURRENT_TIMESTAMP),

  ('acq-step-verlust', 'acq-pipeline-main', 'acq-stage-abschluss', 'Verlust', 'verlust', 'Verlust', 'Verlust', 16, 'Note',
   'Verlust erfassen', 'Grund für den verlorenen Abschluss dokumentieren.',
   '[{"payload":"lossReason","label":"Verlustgrund","type":"select","options":["Preis","Kein Bedarf","Wettbewerb","Timing","Budget","Sonstiges"],"required":true}]'::jsonb,
   true, 'lost', true, false, false, false, false, true, false, true, CURRENT_TIMESTAMP),

  ('acq-step-kein-interesse', 'acq-pipeline-main', 'acq-stage-abschluss', 'kein Interesse', 'kein-interesse', 'kein Interesse', 'kein Interesse', 17, 'Note',
   'Kein Interesse erfassen', 'Absage dokumentieren – Kontaktsperre nach DSGVO wird gesetzt.',
   '[{"payload":"lossReason","label":"Grund (optional)","type":"select","options":["Preis","Kein Bedarf","Wettbewerb","Timing","Budget","Sonstiges"]}]'::jsonb,
   true, 'lost', true, false, false, false, false, true, false, true, CURRENT_TIMESTAMP)
ON CONFLICT ("status") DO UPDATE
  SET "pipelineId" = EXCLUDED."pipelineId", "stageId" = EXCLUDED."stageId", "slug" = EXCLUDED."slug",
      "label" = EXCLUDED."label", "shortLabel" = EXCLUDED."shortLabel", "order" = EXCLUDED."order",
      "activityType" = EXCLUDED."activityType", "title" = EXCLUDED."title", "description" = EXCLUDED."description",
      "requiredFields" = EXCLUDED."requiredFields", "isClosing" = EXCLUDED."isClosing", "outcome" = EXCLUDED."outcome",
      "isWildcard" = EXCLUDED."isWildcard", "isInTalk" = EXCLUDED."isInTalk", "isOffer" = EXCLUDED."isOffer",
      "isOfferSent" = EXCLUDED."isOfferSent", "isWon" = EXCLUDED."isWon", "isLost" = EXCLUDED."isLost",
      "isEarly" = EXCLUDED."isEarly", "active" = EXCLUDED."active", "updatedAt" = CURRENT_TIMESTAMP;

-- ─── 6) Seed: Extra-Transition ──────────────────────────────────────────────
INSERT INTO "AcquisitionPipelineTransition" ("id", "pipelineId", "fromStatus", "toStatus")
VALUES ('acq-trans-qualify-handover', 'acq-pipeline-main', 'kontaktiert', 'Übergabe an Engagement Manager')
ON CONFLICT ("pipelineId", "fromStatus", "toStatus") DO NOTHING;
