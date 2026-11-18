-- Leitfäden + Exit-Kriterien je Akquise-Schritt, Prüfstatus je Zielkunde.

ALTER TABLE "AcquisitionPipelineStep" ADD COLUMN IF NOT EXISTS "guide" JSONB;
ALTER TABLE "AcquisitionPipelineStep" ADD COLUMN IF NOT EXISTS "exitCriteria" JSONB;
ALTER TABLE "AcquisitionTarget" ADD COLUMN IF NOT EXISTS "stepChecks" JSONB;

-- ─── Leitfäden + Exit-Kriterien (kanonisch, idempotent) ─────────────────────

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Unternehmen und Anlass erfassen","Branche und Region prüfen","Ansprechpartner-Rolle festlegen"]$j$,
  "exitCriteria" = $j$[{"k":"created","t":"Firma, Branche und Region erfasst","auto":"field:companyName"},{"k":"role","t":"Ansprechpartner-Rolle benannt"}]$j$
WHERE "status" = 'offen';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["KI-Recherche starten","KI-Initiativen und Schmerzpunkte sammeln","Entscheider-Rollen eingrenzen"]$j$,
  "exitCriteria" = $j$[{"k":"data","t":"Branche und Mitarbeiterzahl erfasst","auto":"num:numberOfEmployees"},{"k":"pain","t":"Schmerz-Hypothese notiert"}]$j$
WHERE "status" = 'recherchiert';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Warmen Weg prüfen (Empfehlung, Event)","LinkedIn-Profil verifizieren","Kontaktanfrage senden"]$j$,
  "exitCriteria" = $j$[{"k":"person","t":"Ansprechpartner identifiziert","auto":"field:contactName"},{"k":"way","t":"Kontaktweg dokumentiert"}]$j$
WHERE "status" = 'vernetzt';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Anlass und Rechtsgrundlage klären (§ 7 UWG)","Genau einen Kanal pro Versuch nutzen","Ergebnis festhalten"]$j$,
  "exitCriteria" = $j$[{"k":"legal","t":"Anruf-Trigger oder Einwilligung dokumentiert","auto":"field:callTrigger"},{"k":"contact","t":"Kontakt-Aktivität mit Ergebnis","auto":"activity:Call"},{"k":"next","t":"Nächster Schritt mit Datum gesetzt"}]$j$
WHERE "status" = 'kontaktiert';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Teilnehmer und Agenda abstimmen","Termin im Kalender festhalten","Unterlagen vorbereiten"]$j$,
  "exitCriteria" = $j$[{"k":"date","t":"Termin gesetzt","auto":"field:firstMeetingDate"},{"k":"attendees","t":"Teilnehmer bestätigt"}]$j$
WHERE "status" = 'Qualifizierungsgespräch';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Bedarf, Budget und Zeitrahmen klären","Entscheiderstruktur erfassen","Gesprächsnotiz festhalten"]$j$,
  "exitCriteria" = $j$[{"k":"date","t":"Gesprächsdatum erfasst","auto":"field:firstMeetingDate"},{"k":"scope","t":"Bedarf und Budget dokumentiert"},{"k":"next","t":"Nächster Schritt oder Übergabe vorbereitet"}]$j$
WHERE "status" = 'Qualifizierungsgespräch durchgeführt';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Kontext und Erkenntnisse zusammenfassen","Nächste Schritte mit dem EM abstimmen","Übergabeprotokoll anlegen"]$j$,
  "exitCriteria" = $j$[{"k":"done","t":"Übergabe dokumentiert","auto":"field:handoverDate"},{"k":"em","t":"EM bestätigt"}]$j$
WHERE "status" = 'Übergabe an Engagement Manager';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Termin mit Kunde abstimmen","Teilnehmer festlegen","Agenda senden"]$j$,
  "exitCriteria" = $j$[{"k":"date","t":"Termin gesetzt","auto":"field:firstMeetingDate"},{"k":"invite","t":"Einladung verschickt"}]$j$
WHERE "status" = 'Erstgespräch terminiert';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Ist-Situation aufnehmen","Readiness-Fragebogen ankündigen","Ergebnis festhalten"]$j$,
  "exitCriteria" = $j$[{"k":"held","t":"Termin wahrgenommen","auto":"activity:Meeting"},{"k":"questionnaire","t":"Fragebogen angekündigt"}]$j$
WHERE "status" = 'Erstgespräch durchgeführt';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Fragebogen personalisieren","Link senden","Rücklauf nachhalten"]$j$,
  "exitCriteria" = $j$[{"k":"sent","t":"Fragebogen versendet","auto":"activity:Email"},{"k":"due","t":"Rücklauf-Termin gesetzt"}]$j$
WHERE "status" = 'Fragebogen geschickt';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Antworten auswerten","Use Cases ableiten","Paket, Leistungen und Preis zusammenstellen"]$j$,
  "exitCriteria" = $j$[{"k":"value","t":"Angebotswert gesetzt","auto":"num:offerValue"},{"k":"usecases","t":"Use Cases ausgewählt"}]$j$
WHERE "status" = 'Angebot in Vorbereitung';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Angebot finalisieren","An Kunden senden","Nachfass-Termin setzen"]$j$,
  "exitCriteria" = $j$[{"k":"sent","t":"Angebot versendet","auto":"field:offerDate"},{"k":"valid","t":"Gültigkeit gesetzt"}]$j$
WHERE "status" = 'Angebot versendet';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Rückmeldung einholen","Offene Fragen klären","Konditionen dokumentieren"]$j$,
  "exitCriteria" = $j$[{"k":"feedback","t":"Rückmeldung dokumentiert","auto":"activity:Call"},{"k":"terms","t":"Finale Konditionen festgehalten"}]$j$
WHERE "status" = 'Nachverhandlung';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Account verknüpfen","Vertrag bzw. Projekt anlegen","An Delivery übergeben"]$j$,
  "exitCriteria" = $j$[{"k":"date","t":"Entscheidungsdatum gesetzt","auto":"field:decisionDate"},{"k":"value","t":"Auftragswert gesetzt","auto":"num:offerValue"}]$j$
WHERE "status" = 'gewonnen';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Folgeprojekt anlegen","Kick-off vereinbaren","Budget klären"]$j$,
  "exitCriteria" = $j$[{"k":"project","t":"Projekt angelegt"},{"k":"kickoff","t":"Kick-off terminiert"}]$j$
WHERE "status" = 'Folgeprojekt';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Verlustgrund dokumentieren","Learnings festhalten","Wiedervorlage prüfen"]$j$,
  "exitCriteria" = $j$[{"k":"reason","t":"Verlustgrund gesetzt","auto":"field:lossReason"}]$j$
WHERE "status" = 'Verlust';

UPDATE "AcquisitionPipelineStep" SET
  "guide" = $j$["Absage dokumentieren","Kontaktsperre setzen","Datenminimierung prüfen"]$j$,
  "exitCriteria" = $j$[{"k":"reason","t":"Grund dokumentiert","auto":"field:lossReason"},{"k":"block","t":"Sperrliste-Eintrag bestätigt"}]$j$
WHERE "status" = 'kein Interesse';
