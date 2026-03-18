-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "competenceCenterId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_competenceCenterId_fkey" FOREIGN KEY ("competenceCenterId") REFERENCES "CompetenceCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
