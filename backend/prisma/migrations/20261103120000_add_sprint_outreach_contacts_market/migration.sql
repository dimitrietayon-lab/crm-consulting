-- Phase 3: Outreach-Vorlagen, Sprint-Kontakte, Markt & Planung

-- ─── Outreach-Vorlagen ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SprintOutreachTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'E-Mail',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintOutreachTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SprintOutreachTemplate_channel_idx" ON "SprintOutreachTemplate"("channel");

-- ─── Sprint-Kontakte ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SprintTargetContact" (
    "id" TEXT NOT NULL,
    "sprintTargetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedin" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "emailConsentAt" TIMESTAMP(3),
    "callConsentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintTargetContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SprintTargetContact_sprintTargetId_idx" ON "SprintTargetContact"("sprintTargetId");

ALTER TABLE "SprintTargetContact" ADD CONSTRAINT "SprintTargetContact_sprintTargetId_fkey"
    FOREIGN KEY ("sprintTargetId") REFERENCES "SprintTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Markt & Planung ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SprintRegion" (
    "id" TEXT NOT NULL,
    "bundesland" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintRegion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SprintRegion_bundesland_key" ON "SprintRegion"("bundesland");

CREATE TABLE IF NOT EXISTS "SprintWzMapping" (
    "id" TEXT NOT NULL,
    "wzCode" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintWzMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SprintWzMapping_wzCode_key" ON "SprintWzMapping"("wzCode");

CREATE TABLE IF NOT EXISTS "SprintPackageInfo" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintPackageInfo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SprintPackageInfo_key_key" ON "SprintPackageInfo"("key");

CREATE TABLE IF NOT EXISTS "SprintSegment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintSegment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SprintSegment_name_key" ON "SprintSegment"("name");

-- ─── Seed: Fokusregionen ─────────────────────────────────────────────────────
INSERT INTO "SprintRegion" ("id", "bundesland", "priority", "note", "updatedAt") VALUES
  ('sprint-region-he', 'Hessen', 1, 'Startmarkt – 8.021 Unternehmen ab 50 MA', CURRENT_TIMESTAMP),
  ('sprint-region-nw', 'Nordrhein-Westfalen', 2, 'Größter Fokusmarkt', CURRENT_TIMESTAMP),
  ('sprint-region-bw', 'Baden-Württemberg', 3, 'Produktion und Automotive', CURRENT_TIMESTAMP),
  ('sprint-region-by', 'Bayern', 4, 'Produktion und Finanz', CURRENT_TIMESTAMP)
ON CONFLICT ("bundesland") DO NOTHING;

-- ─── Seed: WZ-2008-Zuordnung ─────────────────────────────────────────────────
INSERT INTO "SprintWzMapping" ("id", "wzCode", "segment", "priority", "updatedAt") VALUES
  ('sprint-wz-finanz', '64-66', 'Finanz: Banken, Sparkassen, Versicherungen, Leasing', 1, CURRENT_TIMESTAMP),
  ('sprint-wz-produktion', '27-30', 'Produktion: Maschinenbau, Elektro, Automotive, Chemie', 1, CURRENT_TIMESTAMP),
  ('sprint-wz-handel', '45-47', 'Handel: Groß- und Einzelhandel', 2, CURRENT_TIMESTAMP),
  ('sprint-wz-logistik', '49-53', 'Logistik: Transport, Lager, Post', 2, CURRENT_TIMESTAMP),
  ('sprint-wz-beratung', '62,63,70-72', 'Sonstiges: IT-Dienstleister, Beratung', 3, CURRENT_TIMESTAMP)
ON CONFLICT ("wzCode") DO NOTHING;

-- ─── Seed: Pakete ────────────────────────────────────────────────────────────
INSERT INTO "SprintPackageInfo" ("id", "key", "label", "price", "description", "updatedAt") VALUES
  ('sprint-pkg-compact', 'compact', 'Compact', 5990, 'Kompakter Einstieg mit Readiness-Assessment', CURRENT_TIMESTAMP),
  ('sprint-pkg-standard', 'standard', 'Standard', 9990, 'Assessment, Use-Case-Workshop und Roadmap', CURRENT_TIMESTAMP),
  ('sprint-pkg-premium', 'premium', 'Premium', 14990, 'Ganzheitlicher Sprint inkl. Umsetzungsbegleitung', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- ─── Seed: Segmente ──────────────────────────────────────────────────────────
INSERT INTO "SprintSegment" ("id", "name", "sortOrder", "updatedAt") VALUES
  ('sprint-seg-finanz', 'Finanz: Banken, Sparkassen, Versicherungen, Leasing', 1, CURRENT_TIMESTAMP),
  ('sprint-seg-produktion', 'Produktion: Maschinenbau, Elektro, Automotive, Chemie', 2, CURRENT_TIMESTAMP),
  ('sprint-seg-handel', 'Handel: Groß- und Einzelhandel', 3, CURRENT_TIMESTAMP),
  ('sprint-seg-logistik', 'Logistik: Transport, Lager, Post', 4, CURRENT_TIMESTAMP),
  ('sprint-seg-sonstiges', 'Sonstiges: IT-Dienstleister, Beratung', 5, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
