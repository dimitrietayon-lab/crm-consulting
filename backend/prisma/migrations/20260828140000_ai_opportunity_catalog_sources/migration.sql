-- AlterTable
ALTER TABLE "AiOpportunity" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "AiOpportunity" ADD COLUMN "sources" JSONB;

-- AddForeignKey
ALTER TABLE "AiOpportunity" ADD CONSTRAINT "AiOpportunity_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
