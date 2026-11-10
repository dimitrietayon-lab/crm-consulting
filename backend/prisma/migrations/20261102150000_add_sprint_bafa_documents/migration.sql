-- BAFA-Nachweise und Förderfelder
CREATE TABLE "SprintBafaDocument" (
    "id" TEXT NOT NULL,
    "sprintTargetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offen',
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintBafaDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SprintBafaDocument_sprintTargetId_idx" ON "SprintBafaDocument"("sprintTargetId");

ALTER TABLE "SprintBafaDocument" ADD CONSTRAINT "SprintBafaDocument_sprintTargetId_fkey" FOREIGN KEY ("sprintTargetId") REFERENCES "SprintTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SprintTarget" ADD COLUMN IF NOT EXISTS "bafaApprovedAmount" DOUBLE PRECISION;
ALTER TABLE "SprintTarget" ADD COLUMN IF NOT EXISTS "bafaSubmittedAt" TIMESTAMP(3);
ALTER TABLE "SprintTarget" ADD COLUMN IF NOT EXISTS "bafaNotes" TEXT;
