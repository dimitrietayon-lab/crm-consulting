-- AlterTable
ALTER TABLE "User" ADD COLUMN     "competenceCenterId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_competenceCenterId_fkey" FOREIGN KEY ("competenceCenterId") REFERENCES "CompetenceCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
