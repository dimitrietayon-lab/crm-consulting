-- AlterTable
ALTER TABLE "SprintTarget" ADD COLUMN     "aiExpertId" TEXT,
ADD COLUMN     "leadConsultantId" TEXT,
ADD COLUMN     "salesOwnerId" TEXT;

-- AddForeignKey
ALTER TABLE "SprintTarget" ADD CONSTRAINT "SprintTarget_aiExpertId_fkey" FOREIGN KEY ("aiExpertId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintTarget" ADD CONSTRAINT "SprintTarget_leadConsultantId_fkey" FOREIGN KEY ("leadConsultantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintTarget" ADD CONSTRAINT "SprintTarget_salesOwnerId_fkey" FOREIGN KEY ("salesOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
