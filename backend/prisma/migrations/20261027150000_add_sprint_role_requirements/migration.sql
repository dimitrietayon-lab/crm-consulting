-- Rollenbedarf je Paket (welche Rollen, welcher Umfang)
CREATE TABLE "SprintPackageRole" (
    "id" TEXT NOT NULL,
    "package" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintPackageRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SprintPackageRole_package_role_key" ON "SprintPackageRole"("package", "role");

-- Kundenspezifischer Rollenbedarf (aus Paket übernommen, pro Kunde anpassbar)
CREATE TABLE "SprintTargetRole" (
    "id" TEXT NOT NULL,
    "sprintTargetId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintTargetRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SprintTargetRole_sprintTargetId_role_key" ON "SprintTargetRole"("sprintTargetId", "role");
CREATE INDEX "SprintTargetRole_sprintTargetId_idx" ON "SprintTargetRole"("sprintTargetId");

ALTER TABLE "SprintTargetRole" ADD CONSTRAINT "SprintTargetRole_sprintTargetId_fkey" FOREIGN KEY ("sprintTargetId") REFERENCES "SprintTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Standard-Rollenbedarf je Paket
INSERT INTO "SprintPackageRole" ("id", "package", "role", "headcount", "createdAt", "updatedAt")
VALUES
  (concat('spr_', md5('compact-ki')),     'compact',  'ki',    1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('spr_', md5('compact-sales')),  'compact',  'sales', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('spr_', md5('standard-lead')),  'standard', 'lead',  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('spr_', md5('standard-ki')),    'standard', 'ki',    1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('spr_', md5('standard-sales')), 'standard', 'sales', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('spr_', md5('premium-lead')),   'premium',  'lead',  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('spr_', md5('premium-ki')),     'premium',  'ki',    2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('spr_', md5('premium-sales')),  'premium',  'sales', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("package", "role") DO NOTHING;
