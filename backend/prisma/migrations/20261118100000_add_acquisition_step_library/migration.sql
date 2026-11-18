-- Schritt-Bibliothek: wiederverwendbare Standard-Schritte + Custom-Schritt
-- (Fragebogen). Idempotent über IF NOT EXISTS / ON CONFLICT.
-- Dieselben Rows legt prisma/seed-pipeline.js an.

-- ─── 1) Tabelle ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AcquisitionStepTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shortLabel" TEXT,
    "activityType" TEXT NOT NULL DEFAULT 'Note',
    "title" TEXT,
    "description" TEXT,
    "guide" JSONB,
    "exitCriteria" JSONB,
    "requiredFields" JSONB,
    "isEarly" BOOLEAN NOT NULL DEFAULT false,
    "isInTalk" BOOLEAN NOT NULL DEFAULT false,
    "isOffer" BOOLEAN NOT NULL DEFAULT false,
    "isOfferSent" BOOLEAN NOT NULL DEFAULT false,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "isWildcard" BOOLEAN NOT NULL DEFAULT false,
    "isClosing" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT,
    "isStandard" BOOLEAN NOT NULL DEFAULT true,
    "ownerPipelineId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionStepTemplate_pkey" PRIMARY KEY ("id")
);

-- ─── 2) Indizes + FK ────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "AcquisitionStepTemplate_key_key" ON "AcquisitionStepTemplate"("key");
CREATE INDEX IF NOT EXISTS "AcquisitionStepTemplate_ownerPipelineId_idx" ON "AcquisitionStepTemplate"("ownerPipelineId");
CREATE INDEX IF NOT EXISTS "AcquisitionStepTemplate_isStandard_idx" ON "AcquisitionStepTemplate"("isStandard");

DO $$ BEGIN
  ALTER TABLE "AcquisitionStepTemplate" ADD CONSTRAINT "AcquisitionStepTemplate_ownerPipelineId_fkey" FOREIGN KEY ("ownerPipelineId") REFERENCES "AcquisitionPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3) Seed: 16 Standard-Templates + 1 Custom (Fragebogen) ─────────────────
INSERT INTO "AcquisitionStepTemplate"
  ("id", "key", "label", "shortLabel", "activityType", "title", "description", "guide", "exitCriteria",
   "requiredFields", "isEarly", "isInTalk", "isOffer", "isOfferSent", "isWon", "isLost", "isWildcard",
   "isClosing", "outcome", "isStandard", "ownerPipelineId", "active", "updatedAt")
VALUES
  ('acq-tpl-offen', 'offen', 'offen', 'offen', 'Note', 'Zielkunde anlegen',
   'Neuen Zielkunden erfassen und der Akquise zuordnen.',
   '["Unternehmen und Anlass erfassen","Branche und Region prüfen","Ansprechpartner-Rolle festlegen"]'::jsonb,
   '[{"k":"created","t":"Firma, Branche und Region erfasst","auto":"field:companyName"},{"k":"role","t":"Ansprechpartner-Rolle benannt"}]'::jsonb,
   '[]'::jsonb, true, false, false, false, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-recherchiert', 'recherchiert', 'recherchiert', 'recherchiert', 'Note', 'Unternehmen recherchieren',
   'Branche, Größe, KI-Initiativen und passende Entscheider recherchieren und erfassen.',
   '["KI-Recherche starten","KI-Initiativen und Schmerzpunkte sammeln","Entscheider-Rollen eingrenzen"]'::jsonb,
   '[{"k":"data","t":"Branche und Mitarbeiterzahl erfasst","auto":"num:numberOfEmployees"},{"k":"pain","t":"Schmerz-Hypothese notiert"}]'::jsonb,
   '[]'::jsonb, true, false, false, false, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-vernetzt', 'vernetzt', 'vernetzt', 'vernetzt', 'Note', 'Entscheider vernetzen',
   'Ansprechpartner identifizieren und über LinkedIn oder das Netzwerk verbinden.',
   '["Warmen Weg prüfen (Empfehlung, Event)","LinkedIn-Profil verifizieren","Kontaktanfrage senden"]'::jsonb,
   '[{"k":"person","t":"Ansprechpartner identifiziert","auto":"field:contactName"},{"k":"way","t":"Kontaktweg dokumentiert"}]'::jsonb,
   '[]'::jsonb, true, false, false, false, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-kontaktiert', 'kontaktiert', 'kontaktiert', 'kontaktiert', 'Call', 'Erstkontakt herstellen',
   'Telefonisch oder per E-Mail kontaktieren – Anlass und Rechtsgrundlage nach § 7 UWG prüfen.',
   '["Anlass und Rechtsgrundlage klären (§ 7 UWG)","Genau einen Kanal pro Versuch nutzen","Ergebnis festhalten"]'::jsonb,
   '[{"k":"legal","t":"Anruf-Trigger oder Einwilligung dokumentiert","auto":"field:callTrigger"},{"k":"contact","t":"Kontakt-Aktivität mit Ergebnis","auto":"activity:Call"},{"k":"next","t":"Nächster Schritt mit Datum gesetzt"}]'::jsonb,
   '[]'::jsonb, true, false, false, false, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-qualifizierungsgespraech', 'qualifizierungsgespraech', 'Qualifizierungsgespräch planen', 'Qualifizierungsgespräch', 'Meeting', 'Qualifizierungsgespräch planen',
   'Termin mit dem Kunden abstimmen, Teilnehmer festlegen und im Kalender festhalten.',
   '["Teilnehmer und Agenda abstimmen","Termin im Kalender festhalten","Unterlagen vorbereiten"]'::jsonb,
   '[{"k":"date","t":"Termin gesetzt","auto":"field:firstMeetingDate"},{"k":"attendees","t":"Teilnehmer bestätigt"}]'::jsonb,
   '[{"payload":"firstMeetingDate","label":"Termin Qualifizierungsgespräch","type":"date"}]'::jsonb,
   false, true, false, false, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-qualifizierungsgespraech-durchgefuehrt', 'qualifizierungsgespraech-durchgefuehrt', 'Qualifizierungsgespräch durchgeführt', 'Qualifizierungsgespräch durchgeführt', 'Meeting', 'Qualifizierungsgespräch durchführen',
   'Bedarf, Budget, Zeitrahmen und Entscheiderstruktur klären und das Gespräch dokumentieren.',
   '["Bedarf, Budget und Zeitrahmen klären","Entscheiderstruktur erfassen","Gesprächsnotiz festhalten"]'::jsonb,
   '[{"k":"date","t":"Gesprächsdatum erfasst","auto":"field:firstMeetingDate"},{"k":"scope","t":"Bedarf und Budget dokumentiert"},{"k":"next","t":"Nächster Schritt oder Übergabe vorbereitet"}]'::jsonb,
   '[{"payload":"firstMeetingDate","label":"Datum Qualifizierungsgespräch","type":"date"}]'::jsonb,
   false, true, false, false, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-uebergabe-an-engagement-manager', 'uebergabe-an-engagement-manager', 'Übergabe an EM', 'Übergabe an Engagement Manager', 'Meeting', 'An Engagement Manager übergeben',
   'Kontext, Erkenntnisse und nächste Schritte vollständig an den EM übergeben.',
   '["Kontext und Erkenntnisse zusammenfassen","Nächste Schritte mit dem EM abstimmen","Übergabeprotokoll anlegen"]'::jsonb,
   '[{"k":"done","t":"Übergabe dokumentiert","auto":"field:handoverDate"},{"k":"em","t":"EM bestätigt"}]'::jsonb,
   '[]'::jsonb, false, true, false, false, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-erstgespraech-terminiert', 'erstgespraech-terminiert', 'Erstgespräch geplant', 'Erstgespräch terminiert', 'Meeting', 'Erstgespräch planen',
   'Termin mit dem Kunden abstimmen, Teilnehmer festlegen und im Kalender festhalten.',
   '["Termin mit Kunde abstimmen","Teilnehmer festlegen","Agenda senden"]'::jsonb,
   '[{"k":"date","t":"Termin gesetzt","auto":"field:firstMeetingDate"},{"k":"invite","t":"Einladung verschickt"}]'::jsonb,
   '[{"payload":"firstMeetingDate","label":"Termin Erstgespräch","type":"date"}]'::jsonb,
   false, true, false, false, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-erstgespraech-durchgefuehrt', 'erstgespraech-durchgefuehrt', 'Erstgespräch durchgeführt', 'Erstgespräch durchgeführt', 'Meeting', 'Erstgespräch durchführen',
   'Termin wahrnehmen, Ist-Situation aufnehmen und den Readiness-Fragebogen ankündigen.',
   '["Ist-Situation aufnehmen","Readiness-Fragebogen ankündigen","Ergebnis festhalten"]'::jsonb,
   '[{"k":"held","t":"Termin wahrgenommen","auto":"activity:Meeting"},{"k":"questionnaire","t":"Fragebogen angekündigt"}]'::jsonb,
   '[{"payload":"firstMeetingDate","label":"Datum Erstgespräch","type":"date"}]'::jsonb,
   false, true, false, false, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-angebot-in-vorbereitung', 'angebot-in-vorbereitung', 'Angebot in Vorbereitung', 'Angebot in Vorbereitung', 'Note', 'Angebot vorbereiten',
   'Antworten auswerten, Use Cases ableiten und Paket, Leistungen und Preis zusammenstellen.',
   '["Antworten auswerten","Use Cases ableiten","Paket, Leistungen und Preis zusammenstellen"]'::jsonb,
   '[{"k":"value","t":"Angebotswert gesetzt","auto":"num:offerValue"},{"k":"usecases","t":"Use Cases ausgewählt"}]'::jsonb,
   '[{"payload":"offerValue","label":"Erwarteter Angebotswert (€)","type":"number"}]'::jsonb,
   false, false, true, false, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-angebot-versendet', 'angebot-versendet', 'Angebot versendet', 'Angebot versendet', 'Email', 'Angebot versenden',
   'Angebot finalisieren und an den Kunden senden.',
   '["Angebot finalisieren","An Kunden senden","Nachfass-Termin setzen"]'::jsonb,
   '[{"k":"sent","t":"Angebot versendet","auto":"field:offerDate"},{"k":"valid","t":"Gültigkeit gesetzt"}]'::jsonb,
   '[{"payload":"offerValue","label":"Angebotswert (€)","type":"number"}]'::jsonb,
   false, false, true, true, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-nachverhandlung', 'nachverhandlung', 'Nachverhandlung', 'Nachverhandlung', 'Call', 'Angebot nachfassen',
   'Rückmeldung einholen, offene Fragen klären und Konditionen verhandeln.',
   '["Rückmeldung einholen","Offene Fragen klären","Konditionen dokumentieren"]'::jsonb,
   '[{"k":"feedback","t":"Rückmeldung dokumentiert","auto":"activity:Call"},{"k":"terms","t":"Finale Konditionen festgehalten"}]'::jsonb,
   '[]'::jsonb, false, false, true, true, false, false, false, false, NULL, true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-gewonnen', 'gewonnen', 'gewonnen', 'gewonnen', 'Note', 'Abschluss speichern',
   'Kunde gewonnen: Account verknüpfen, Vertrag bzw. Projekt anlegen und an die Delivery übergeben.',
   '["Account verknüpfen","Vertrag bzw. Projekt anlegen","An Delivery übergeben"]'::jsonb,
   '[{"k":"date","t":"Entscheidungsdatum gesetzt","auto":"field:decisionDate"},{"k":"value","t":"Auftragswert gesetzt","auto":"num:offerValue"}]'::jsonb,
   '[{"payload":"decisionDate","label":"Entscheidungsdatum","type":"date"},{"payload":"offerValue","label":"Auftragswert (€)","type":"number"}]'::jsonb,
   false, false, false, false, true, false, false, true, 'won', true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-folgeprojekt', 'folgeprojekt', 'Folgeprojekt', 'Folgeprojekt', 'Note', 'Folgeprojekt starten',
   'Folgeprojekt anlegen und den Kick-off mit dem Kunden vereinbaren.',
   '["Folgeprojekt anlegen","Kick-off vereinbaren","Budget klären"]'::jsonb,
   '[{"k":"project","t":"Projekt angelegt"},{"k":"kickoff","t":"Kick-off terminiert"}]'::jsonb,
   '[]'::jsonb, false, false, false, false, true, false, false, true, 'won', true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-verlust', 'verlust', 'Verlust', 'Verlust', 'Note', 'Verlust erfassen',
   'Grund für den verlorenen Abschluss dokumentieren.',
   '["Verlustgrund dokumentieren","Learnings festhalten","Wiedervorlage prüfen"]'::jsonb,
   '[{"k":"reason","t":"Verlustgrund gesetzt","auto":"field:lossReason"}]'::jsonb,
   '[{"payload":"lossReason","label":"Verlustgrund","type":"select","options":["Preis","Kein Bedarf","Wettbewerb","Timing","Budget","Sonstiges"],"required":true}]'::jsonb,
   false, false, false, false, false, true, true, true, 'lost', true, NULL, true, CURRENT_TIMESTAMP),

  ('acq-tpl-kein-interesse', 'kein-interesse', 'kein Interesse', 'kein Interesse', 'Note', 'Kein Interesse erfassen',
   'Absage dokumentieren – Kontaktsperre nach DSGVO wird gesetzt.',
   '["Absage dokumentieren","Kontaktsperre setzen","Datenminimierung prüfen"]'::jsonb,
   '[{"k":"reason","t":"Grund dokumentiert","auto":"field:lossReason"},{"k":"block","t":"Sperrliste-Eintrag bestätigt"}]'::jsonb,
   '[{"payload":"lossReason","label":"Grund (optional)","type":"select","options":["Preis","Kein Bedarf","Wettbewerb","Timing","Budget","Sonstiges"]}]'::jsonb,
   false, false, false, false, false, true, true, true, 'lost', true, NULL, true, CURRENT_TIMESTAMP),

  -- Custom-Schritt: Fragebogen (NICHT Standard, gehört zum KI-Readiness-Workflow)
  ('acq-tpl-fragebogen-geschickt', 'fragebogen-geschickt', 'Fragebogen geschickt', 'Fragebogen geschickt', 'Email', 'Fragebogen senden',
   'Readiness-Fragebogen an den Kunden senden und den Rücklauf nachhalten.',
   '["Fragebogen personalisieren","Link senden","Rücklauf nachhalten"]'::jsonb,
   '[{"k":"sent","t":"Fragebogen versendet","auto":"activity:Email"},{"k":"due","t":"Rücklauf-Termin gesetzt"}]'::jsonb,
   '[]'::jsonb, false, true, false, false, false, false, false, false, NULL, false, 'acq-pipeline-main', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
  SET "label" = EXCLUDED."label", "shortLabel" = EXCLUDED."shortLabel",
      "activityType" = EXCLUDED."activityType", "title" = EXCLUDED."title", "description" = EXCLUDED."description",
      "guide" = EXCLUDED."guide", "exitCriteria" = EXCLUDED."exitCriteria", "requiredFields" = EXCLUDED."requiredFields",
      "isEarly" = EXCLUDED."isEarly", "isInTalk" = EXCLUDED."isInTalk", "isOffer" = EXCLUDED."isOffer",
      "isOfferSent" = EXCLUDED."isOfferSent", "isWon" = EXCLUDED."isWon", "isLost" = EXCLUDED."isLost",
      "isWildcard" = EXCLUDED."isWildcard", "isClosing" = EXCLUDED."isClosing", "outcome" = EXCLUDED."outcome",
      "isStandard" = EXCLUDED."isStandard", "ownerPipelineId" = EXCLUDED."ownerPipelineId",
      "active" = EXCLUDED."active", "updatedAt" = CURRENT_TIMESTAMP;
