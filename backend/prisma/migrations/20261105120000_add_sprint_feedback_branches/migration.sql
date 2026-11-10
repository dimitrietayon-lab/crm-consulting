-- Feedback 01.11.2026: Marktauswahl (Branchen) auf die einheitliche 15er-Liste
-- umstellen. Läuft nach 20261103120000, das SprintSegment/SprintWzMapping anlegt.

-- ─── Marktauswahl: Segmente (Branchen) ersetzen ─────────────────────────────
-- Nur die Seed-Zeilen entfernen; selbst angelegte Segmente bleiben erhalten.
DELETE FROM "SprintSegment" WHERE "id" LIKE 'sprint-seg-%';

INSERT INTO "SprintSegment" ("id", "name", "sortOrder", "updatedAt") VALUES
  ('sprint-seg-01', 'Banken', 1, CURRENT_TIMESTAMP),
  ('sprint-seg-02', 'Bau & Immobilien', 2, CURRENT_TIMESTAMP),
  ('sprint-seg-03', 'Bildung, Sport & Kultur', 3, CURRENT_TIMESTAMP),
  ('sprint-seg-04', 'Energie, Wasser & Entsorgung', 4, CURRENT_TIMESTAMP),
  ('sprint-seg-05', 'Gesundheit & Soziales', 5, CURRENT_TIMESTAMP),
  ('sprint-seg-06', 'Handel & Logistik', 6, CURRENT_TIMESTAMP),
  ('sprint-seg-07', 'Ingenieur- & Architekturbüros', 7, CURRENT_TIMESTAMP),
  ('sprint-seg-08', 'IT & Telekommunikation', 8, CURRENT_TIMESTAMP),
  ('sprint-seg-09', 'Marketing & Medien', 9, CURRENT_TIMESTAMP),
  ('sprint-seg-10', 'Maschinenbau & Elektro', 10, CURRENT_TIMESTAMP),
  ('sprint-seg-11', 'Personaldienstleister', 11, CURRENT_TIMESTAMP),
  ('sprint-seg-12', 'Rechts- & Steuerberatung, WP', 12, CURRENT_TIMESTAMP),
  ('sprint-seg-13', 'Übrige Industrie', 13, CURRENT_TIMESTAMP),
  ('sprint-seg-14', 'Versicherungen & Finanzvermittler', 14, CURRENT_TIMESTAMP),
  ('sprint-seg-15', 'Sonstige', 15, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE
  SET "sortOrder" = EXCLUDED."sortOrder",
      "updatedAt" = CURRENT_TIMESTAMP;

-- ─── WZ-Zuordnung: Segmente auf Branchenliste umstellen ────────────────────
UPDATE "SprintWzMapping" SET "segment" = 'Banken'
WHERE "wzCode" = '64-66';

UPDATE "SprintWzMapping" SET "segment" = 'Übrige Industrie'
WHERE "wzCode" = '27-30';

UPDATE "SprintWzMapping" SET "segment" = 'Handel & Logistik'
WHERE "wzCode" IN ('45-47', '49-53');

UPDATE "SprintWzMapping" SET "segment" = 'IT & Telekommunikation'
WHERE "wzCode" = '62,63,70-72';

UPDATE "SprintWzMapping"
SET "segment" = 'Sonstige'
WHERE "segment" NOT IN (
  'Banken', 'Bau & Immobilien', 'Bildung, Sport & Kultur',
  'Energie, Wasser & Entsorgung', 'Gesundheit & Soziales', 'Handel & Logistik',
  'Ingenieur- & Architekturbüros', 'IT & Telekommunikation', 'Marketing & Medien',
  'Maschinenbau & Elektro', 'Personaldienstleister',
  'Rechts- & Steuerberatung, WP', 'Übrige Industrie',
  'Versicherungen & Finanzvermittler', 'Sonstige'
);
