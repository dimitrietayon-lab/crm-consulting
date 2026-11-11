-- Feature-Übernahme: Aufgaben und Dokumente an Sprint-Zielkunden hängen

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "sprintTargetId" TEXT;
ALTER TABLE "Document" ADD COLUMN "sprintTargetId" TEXT;

-- CreateIndex
CREATE INDEX "Task_sprintTargetId_idx" ON "Task"("sprintTargetId");
CREATE INDEX "Document_sprintTargetId_idx" ON "Document"("sprintTargetId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_sprintTargetId_fkey" FOREIGN KEY ("sprintTargetId") REFERENCES "SprintTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sprintTargetId_fkey" FOREIGN KEY ("sprintTargetId") REFERENCES "SprintTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
