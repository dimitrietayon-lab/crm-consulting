-- Feedback-Umsetzung: Adresse, einheitliche Branchen/Quellen, neues Statusmodell,
-- Datenschutz-Einwilligungen und Selbsttest-Ergebnisse.

-- ─── Neue Spalten ────────────────────────────────────────────────────────────
ALTER TABLE "SprintTarget"
  ADD COLUMN IF NOT EXISTS "street"               TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode"           TEXT,
  ADD COLUMN IF NOT EXISTS "emailConsentRevokedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "privacyNoticeAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "privacyNoticeSource"  TEXT,
  ADD COLUMN IF NOT EXISTS "selfTestScore"        INTEGER,
  ADD COLUMN IF NOT EXISTS "selfTestDate"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "selfTestLink"         TEXT;

-- ─── Status-Mapping auf das neue Modell ──────────────────────────────────────
UPDATE "SprintTarget" SET "status" = 'kontaktiert'
WHERE "status" = 'angerufen';

UPDATE "SprintTarget" SET "status" = 'Qualifizierungsgespräch'
WHERE "status" = 'im Gespräch';

-- ─── Segment → einheitliche 15er-Branchenliste ───────────────────────────────
UPDATE "SprintTarget" SET "segment" = 'Banken'
WHERE "segment" IN ('Finanz: Privatbank', 'Finanz: Sparkasse / Volksbank',
                    'Finanz: Banken, Sparkassen, Versicherungen, Leasing');

UPDATE "SprintTarget" SET "segment" = 'Versicherungen & Finanzvermittler'
WHERE "segment" IN ('Finanz: Versicherung', 'Finanz: Leasing / Factoring');

UPDATE "SprintTarget" SET "segment" = 'Maschinenbau & Elektro'
WHERE "segment" IN ('Produktion: Maschinenbau / Elektro');

UPDATE "SprintTarget" SET "segment" = 'Übrige Industrie'
WHERE "segment" IN ('Produktion: Automotive', 'Produktion: Chemie / Pharma',
                    'Produktion: Maschinenbau, Elektro, Automotive, Chemie');

UPDATE "SprintTarget" SET "segment" = 'Handel & Logistik'
WHERE "segment" IN ('Handel: Groß- / Einzelhandel', 'Handel: Groß- und Einzelhandel',
                    'Logistik', 'Logistik: Transport, Lager, Post');

UPDATE "SprintTarget" SET "segment" = 'IT & Telekommunikation'
WHERE "segment" IN ('Sonstiges: IT-Dienstleister, Beratung');

UPDATE "SprintTarget" SET "segment" = 'Sonstige'
WHERE "segment" = 'Sonstiges';

-- Alles, was nicht in der kanonischen Liste steht, wird zu "Sonstige".
UPDATE "SprintTarget"
SET "segment" = 'Sonstige'
WHERE "segment" NOT IN (
  'Banken', 'Bau & Immobilien', 'Bildung, Sport & Kultur',
  'Energie, Wasser & Entsorgung', 'Gesundheit & Soziales', 'Handel & Logistik',
  'Ingenieur- & Architekturbüros', 'IT & Telekommunikation', 'Marketing & Medien',
  'Maschinenbau & Elektro', 'Personaldienstleister',
  'Rechts- & Steuerberatung, WP', 'Übrige Industrie',
  'Versicherungen & Finanzvermittler', 'Sonstige'
);

-- ─── Quelle → einheitliche Liste ────────────────────────────────────────────
UPDATE "SprintTarget" SET "contactSource" = 'Messe / Event'
WHERE "contactSource" = 'Messe';

UPDATE "SprintTarget"
SET "contactSource" = 'Sonstiges'
WHERE "contactSource" IS NOT NULL
  AND "contactSource" NOT IN (
    'Bestandskunde', 'Empfehlung', 'Kaltakquise', 'LinkedIn', 'Messe / Event',
    'Netzwerk', 'Recherche', 'Selbsttest', 'Vortrag', 'Webinar',
    'Webseite-Anfrage', 'Sonstiges'
  );

-- Marktauswahl (SprintSegment / SprintWzMapping) wird bewusst in der späteren
-- Migration 20261105120000_add_sprint_feedback_branches angepasst, weil diese
-- Tabellen erst mit 20261103120000 angelegt werden.
