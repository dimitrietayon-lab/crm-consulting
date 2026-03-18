/*
  Warnings:

  - You are about to drop the column `departmentId` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the `Department` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_headId_fkey";

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_departmentId_fkey";

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "departmentId",
ADD COLUMN     "competenceCenterId" TEXT;

-- DropTable
DROP TABLE "Department";

-- CreateTable
CREATE TABLE "CompetenceCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetenceCenter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetenceCenter_name_key" ON "CompetenceCenter"("name");

-- AddForeignKey
ALTER TABLE "CompetenceCenter" ADD CONSTRAINT "CompetenceCenter_headId_fkey" FOREIGN KEY ("headId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_competenceCenterId_fkey" FOREIGN KEY ("competenceCenterId") REFERENCES "CompetenceCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
