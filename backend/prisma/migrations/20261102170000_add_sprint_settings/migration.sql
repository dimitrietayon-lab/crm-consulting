-- Serverseitige Sprint-Einstellungen (Singleton)
CREATE TABLE "SprintSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "linkedinQuota" INTEGER NOT NULL DEFAULT 75,
    "callsQuota" INTEGER NOT NULL DEFAULT 100,
    "hoursPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 8.4,
    "offerValidityDays" INTEGER NOT NULL DEFAULT 21,
    "targetFirms" INTEGER NOT NULL DEFAULT 878,
    "teamCapacity" INTEGER NOT NULL DEFAULT 10,
    "revenueTarget" DOUBLE PRECISION NOT NULL DEFAULT 500000,
    "sprintName" TEXT NOT NULL DEFAULT 'KI-Readiness Sprint',
    "sprintStart" TIMESTAMP(3),
    "sprintEnd" TIMESTAMP(3),
    "packages" JSONB,
    "segments" JSONB,
    "notifications" JSONB,
    "bafaParams" JSONB,
    "linkedin" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintSetting_pkey" PRIMARY KEY ("id")
);
