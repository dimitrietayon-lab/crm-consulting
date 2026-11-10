-- CreateTable
CREATE TABLE "SprintTarget" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "location" TEXT,
    "bundesland" TEXT,
    "segment" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT '1',
    "package" TEXT,
    "numberOfEmployees" INTEGER,
    "sizeCheckedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'offen',
    "contactSource" TEXT,
    "ponturoRelationship" TEXT,
    "contactName" TEXT,
    "contactTitle" TEXT,
    "contactLinkedIn" TEXT,
    "callAttempts" INTEGER NOT NULL DEFAULT 0,
    "callTrigger" TEXT,
    "emailAllowed" BOOLEAN,
    "handoverDate" TIMESTAMP(3),
    "firstMeetingDate" TIMESTAMP(3),
    "offerPackage" TEXT,
    "offerValue" DOUBLE PRECISION,
    "offerDate" TIMESTAMP(3),
    "bafaDate" TIMESTAMP(3),
    "bafaStatus" TEXT,
    "result" TEXT,
    "lossReason" TEXT,
    "notes" TEXT,
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintBlocklist" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "reason" TEXT,
    "contactName" TEXT,
    "notes" TEXT,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintBlocklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintAssessment" (
    "id" TEXT NOT NULL,
    "sprintTargetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "totalScore" DOUBLE PRECISION,
    "dataAvailability" DOUBLE PRECISION,
    "techStack" DOUBLE PRECISION,
    "processMaturity" DOUBLE PRECISION,
    "aiCompetency" DOUBLE PRECISION,
    "governance" DOUBLE PRECISION,
    "strategy" DOUBLE PRECISION,
    "findings" TEXT,
    "recommendations" TEXT,
    "generatedByAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UseCaseCandidate" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "type" TEXT NOT NULL DEFAULT 'implementierung',
    "feasibility" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "basis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UseCaseCandidate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "sprintTargetId" TEXT;

-- CreateIndex
CREATE INDEX "SprintBlocklist_normalizedName_idx" ON "SprintBlocklist"("normalizedName");

-- AddForeignKey
ALTER TABLE "SprintTarget" ADD CONSTRAINT "SprintTarget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_sprintTargetId_fkey" FOREIGN KEY ("sprintTargetId") REFERENCES "SprintTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintAssessment" ADD CONSTRAINT "SprintAssessment_sprintTargetId_fkey" FOREIGN KEY ("sprintTargetId") REFERENCES "SprintTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UseCaseCandidate" ADD CONSTRAINT "UseCaseCandidate_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "SprintAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
