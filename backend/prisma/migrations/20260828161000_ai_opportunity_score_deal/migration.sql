-- AlterTable
ALTER TABLE "AiOpportunity" ADD COLUMN "scoreBreakdown" JSONB;
ALTER TABLE "AiOpportunity" ADD COLUMN "dealId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AiOpportunity_dealId_key" ON "AiOpportunity"("dealId");

-- AddForeignKey
ALTER TABLE "AiOpportunity" ADD CONSTRAINT "AiOpportunity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
