-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "actions" JSONB,
ADD COLUMN     "conditions" JSONB,
ADD COLUMN     "domain" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN     "triggerConfig" JSONB,
ALTER COLUMN "actionType" DROP NOT NULL;
