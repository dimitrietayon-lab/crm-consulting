-- Übergabe an das Umsetzungsteam (6-Punkte-Checkliste)
CREATE TABLE "SprintHandover" (
    "id" TEXT NOT NULL,
    "sprintTargetId" TEXT NOT NULL,
    "checklist" JSONB,
    "kickoffDate" TIMESTAMP(3),
    "firstWorkshopDate" TIMESTAMP(3),
    "format" TEXT,
    "participants" TEXT,
    "emUserId" TEXT,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintHandover_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SprintHandover_sprintTargetId_key" ON "SprintHandover"("sprintTargetId");

ALTER TABLE "SprintHandover" ADD CONSTRAINT "SprintHandover_sprintTargetId_fkey" FOREIGN KEY ("sprintTargetId") REFERENCES "SprintTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintHandover" ADD CONSTRAINT "SprintHandover_emUserId_fkey" FOREIGN KEY ("emUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
