-- Mehrfachzuweisungen pro Rolle (ein oder mehrere Mitarbeiter je Rolle)
CREATE TABLE "SprintAssignment" (
    "id" TEXT NOT NULL,
    "sprintTargetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SprintAssignment_sprintTargetId_userId_role_key" ON "SprintAssignment"("sprintTargetId", "userId", "role");
CREATE INDEX "SprintAssignment_userId_idx" ON "SprintAssignment"("userId");
CREATE INDEX "SprintAssignment_sprintTargetId_idx" ON "SprintAssignment"("sprintTargetId");

ALTER TABLE "SprintAssignment" ADD CONSTRAINT "SprintAssignment_sprintTargetId_fkey" FOREIGN KEY ("sprintTargetId") REFERENCES "SprintTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintAssignment" ADD CONSTRAINT "SprintAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bestehende Einzelzuweisungen in die neue Tabelle übernehmen
INSERT INTO "SprintAssignment" ("id", "sprintTargetId", "userId", "role", "createdAt")
SELECT concat('sa_', md5(random()::text || clock_timestamp()::text || "id" || "leadConsultantId")), "id", "leadConsultantId", 'lead', CURRENT_TIMESTAMP
FROM "SprintTarget" WHERE "leadConsultantId" IS NOT NULL
ON CONFLICT ("sprintTargetId", "userId", "role") DO NOTHING;

INSERT INTO "SprintAssignment" ("id", "sprintTargetId", "userId", "role", "createdAt")
SELECT concat('sa_', md5(random()::text || clock_timestamp()::text || "id" || "aiExpertId")), "id", "aiExpertId", 'ki', CURRENT_TIMESTAMP
FROM "SprintTarget" WHERE "aiExpertId" IS NOT NULL
ON CONFLICT ("sprintTargetId", "userId", "role") DO NOTHING;

INSERT INTO "SprintAssignment" ("id", "sprintTargetId", "userId", "role", "createdAt")
SELECT concat('sa_', md5(random()::text || clock_timestamp()::text || "id" || "salesOwnerId")), "id", "salesOwnerId", 'sales', CURRENT_TIMESTAMP
FROM "SprintTarget" WHERE "salesOwnerId" IS NOT NULL
ON CONFLICT ("sprintTargetId", "userId", "role") DO NOTHING;

-- Alte Einzelspalten entfernen
ALTER TABLE "SprintTarget" DROP CONSTRAINT IF EXISTS "SprintTarget_leadConsultantId_fkey";
ALTER TABLE "SprintTarget" DROP CONSTRAINT IF EXISTS "SprintTarget_aiExpertId_fkey";
ALTER TABLE "SprintTarget" DROP CONSTRAINT IF EXISTS "SprintTarget_salesOwnerId_fkey";

ALTER TABLE "SprintTarget" DROP COLUMN IF EXISTS "leadConsultantId";
ALTER TABLE "SprintTarget" DROP COLUMN IF EXISTS "aiExpertId";
ALTER TABLE "SprintTarget" DROP COLUMN IF EXISTS "salesOwnerId";
