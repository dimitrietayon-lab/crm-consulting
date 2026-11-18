-- Rename Sprint* -> Acquisition* (tables, columns, constraints, indexes).
-- Prisma cannot emit ALTER ... RENAME, therefore handwritten. No data loss.

-- ─── 1) Tabellen ────────────────────────────────────────────────────────────
ALTER TABLE "SprintTarget"           RENAME TO "AcquisitionTarget";
ALTER TABLE "SprintBlocklist"        RENAME TO "AcquisitionBlocklist";
ALTER TABLE "SprintAssessment"       RENAME TO "AcquisitionAssessment";
ALTER TABLE "SprintOffer"            RENAME TO "AcquisitionOffer";
ALTER TABLE "SprintOfferItem"        RENAME TO "AcquisitionOfferItem";
ALTER TABLE "SprintOfferSequence"    RENAME TO "AcquisitionOfferSequence";
ALTER TABLE "SprintBafaDocument"     RENAME TO "AcquisitionBafaDocument";
ALTER TABLE "SprintHandover"         RENAME TO "AcquisitionHandover";
ALTER TABLE "SprintSetting"          RENAME TO "AcquisitionSetting";
ALTER TABLE "SprintOutreachTemplate" RENAME TO "AcquisitionOutreachTemplate";
ALTER TABLE "SprintTargetContact"    RENAME TO "AcquisitionTargetContact";
ALTER TABLE "SprintRegion"           RENAME TO "AcquisitionRegion";
ALTER TABLE "SprintWzMapping"        RENAME TO "AcquisitionWzMapping";
ALTER TABLE "SprintPackageInfo"      RENAME TO "AcquisitionPackageInfo";
ALTER TABLE "SprintPackageService"   RENAME TO "AcquisitionPackageService";
ALTER TABLE "SprintSegment"          RENAME TO "AcquisitionSegment";
ALTER TABLE "SprintAssignment"       RENAME TO "AcquisitionAssignment";
ALTER TABLE "SprintTargetRole"       RENAME TO "AcquisitionTargetRole";

-- ─── 2) Spalten sprintTargetId -> acquisitionTargetId ───────────────────────
ALTER TABLE "Activity"                RENAME COLUMN "sprintTargetId" TO "acquisitionTargetId";
ALTER TABLE "Task"                    RENAME COLUMN "sprintTargetId" TO "acquisitionTargetId";
ALTER TABLE "Document"                RENAME COLUMN "sprintTargetId" TO "acquisitionTargetId";
ALTER TABLE "AcquisitionAssessment"   RENAME COLUMN "sprintTargetId" TO "acquisitionTargetId";
ALTER TABLE "AcquisitionOffer"        RENAME COLUMN "sprintTargetId" TO "acquisitionTargetId";
ALTER TABLE "AcquisitionBafaDocument" RENAME COLUMN "sprintTargetId" TO "acquisitionTargetId";
ALTER TABLE "AcquisitionHandover"     RENAME COLUMN "sprintTargetId" TO "acquisitionTargetId";
ALTER TABLE "AcquisitionTargetContact" RENAME COLUMN "sprintTargetId" TO "acquisitionTargetId";
ALTER TABLE "AcquisitionAssignment"   RENAME COLUMN "sprintTargetId" TO "acquisitionTargetId";
ALTER TABLE "AcquisitionTargetRole"   RENAME COLUMN "sprintTargetId" TO "acquisitionTargetId";

-- ─── 2b) Setting-Spalten (sprintName/Start/End) ─────────────────────────────
ALTER TABLE "AcquisitionSetting" RENAME COLUMN "sprintName"  TO "name";
ALTER TABLE "AcquisitionSetting" RENAME COLUMN "sprintStart" TO "startDate";
ALTER TABLE "AcquisitionSetting" RENAME COLUMN "sprintEnd"   TO "endDate";

-- ─── 3) Primary Keys ────────────────────────────────────────────────────────
ALTER TABLE "AcquisitionTarget"          RENAME CONSTRAINT "SprintTarget_pkey"           TO "AcquisitionTarget_pkey";
ALTER TABLE "AcquisitionBlocklist"       RENAME CONSTRAINT "SprintBlocklist_pkey"        TO "AcquisitionBlocklist_pkey";
ALTER TABLE "AcquisitionAssessment"      RENAME CONSTRAINT "SprintAssessment_pkey"       TO "AcquisitionAssessment_pkey";
ALTER TABLE "AcquisitionOffer"           RENAME CONSTRAINT "SprintOffer_pkey"            TO "AcquisitionOffer_pkey";
ALTER TABLE "AcquisitionOfferItem"       RENAME CONSTRAINT "SprintOfferItem_pkey"        TO "AcquisitionOfferItem_pkey";
ALTER TABLE "AcquisitionOfferSequence"   RENAME CONSTRAINT "SprintOfferSequence_pkey"    TO "AcquisitionOfferSequence_pkey";
ALTER TABLE "AcquisitionBafaDocument"    RENAME CONSTRAINT "SprintBafaDocument_pkey"     TO "AcquisitionBafaDocument_pkey";
ALTER TABLE "AcquisitionHandover"        RENAME CONSTRAINT "SprintHandover_pkey"         TO "AcquisitionHandover_pkey";
ALTER TABLE "AcquisitionSetting"         RENAME CONSTRAINT "SprintSetting_pkey"          TO "AcquisitionSetting_pkey";
ALTER TABLE "AcquisitionOutreachTemplate" RENAME CONSTRAINT "SprintOutreachTemplate_pkey" TO "AcquisitionOutreachTemplate_pkey";
ALTER TABLE "AcquisitionTargetContact"   RENAME CONSTRAINT "SprintTargetContact_pkey"    TO "AcquisitionTargetContact_pkey";
ALTER TABLE "AcquisitionRegion"          RENAME CONSTRAINT "SprintRegion_pkey"           TO "AcquisitionRegion_pkey";
ALTER TABLE "AcquisitionWzMapping"       RENAME CONSTRAINT "SprintWzMapping_pkey"        TO "AcquisitionWzMapping_pkey";
ALTER TABLE "AcquisitionPackageInfo"     RENAME CONSTRAINT "SprintPackageInfo_pkey"      TO "AcquisitionPackageInfo_pkey";
ALTER TABLE "AcquisitionPackageService"  RENAME CONSTRAINT "SprintPackageService_pkey"   TO "AcquisitionPackageService_pkey";
ALTER TABLE "AcquisitionSegment"         RENAME CONSTRAINT "SprintSegment_pkey"          TO "AcquisitionSegment_pkey";
ALTER TABLE "AcquisitionAssignment"      RENAME CONSTRAINT "SprintAssignment_pkey"       TO "AcquisitionAssignment_pkey";
ALTER TABLE "AcquisitionTargetRole"      RENAME CONSTRAINT "SprintTargetRole_pkey"       TO "AcquisitionTargetRole_pkey";

-- ─── 3b) Foreign Keys ───────────────────────────────────────────────────────
ALTER TABLE "AcquisitionTarget"          RENAME CONSTRAINT "SprintTarget_accountId_fkey"            TO "AcquisitionTarget_accountId_fkey";
ALTER TABLE "AcquisitionAssessment"      RENAME CONSTRAINT "SprintAssessment_sprintTargetId_fkey"   TO "AcquisitionAssessment_acquisitionTargetId_fkey";
ALTER TABLE "AcquisitionOffer"           RENAME CONSTRAINT "SprintOffer_sprintTargetId_fkey"        TO "AcquisitionOffer_acquisitionTargetId_fkey";
ALTER TABLE "AcquisitionOfferItem"       RENAME CONSTRAINT "SprintOfferItem_offerId_fkey"           TO "AcquisitionOfferItem_offerId_fkey";
ALTER TABLE "AcquisitionBafaDocument"    RENAME CONSTRAINT "SprintBafaDocument_sprintTargetId_fkey" TO "AcquisitionBafaDocument_acquisitionTargetId_fkey";
ALTER TABLE "AcquisitionHandover"        RENAME CONSTRAINT "SprintHandover_sprintTargetId_fkey"     TO "AcquisitionHandover_acquisitionTargetId_fkey";
ALTER TABLE "AcquisitionHandover"        RENAME CONSTRAINT "SprintHandover_emUserId_fkey"           TO "AcquisitionHandover_emUserId_fkey";
ALTER TABLE "AcquisitionTargetContact"   RENAME CONSTRAINT "SprintTargetContact_sprintTargetId_fkey" TO "AcquisitionTargetContact_acquisitionTargetId_fkey";
ALTER TABLE "AcquisitionAssignment"      RENAME CONSTRAINT "SprintAssignment_sprintTargetId_fkey"   TO "AcquisitionAssignment_acquisitionTargetId_fkey";
ALTER TABLE "AcquisitionAssignment"      RENAME CONSTRAINT "SprintAssignment_userId_fkey"           TO "AcquisitionAssignment_userId_fkey";
ALTER TABLE "AcquisitionTargetRole"      RENAME CONSTRAINT "SprintTargetRole_sprintTargetId_fkey"   TO "AcquisitionTargetRole_acquisitionTargetId_fkey";
ALTER TABLE "AcquisitionPackageService"  RENAME CONSTRAINT "SprintPackageService_package_fkey"      TO "AcquisitionPackageService_package_fkey";
ALTER TABLE "AcquisitionPackageService"  RENAME CONSTRAINT "SprintPackageService_serviceId_fkey"    TO "AcquisitionPackageService_serviceId_fkey";
ALTER TABLE "Activity"                   RENAME CONSTRAINT "Activity_sprintTargetId_fkey"            TO "Activity_acquisitionTargetId_fkey";
ALTER TABLE "Task"                       RENAME CONSTRAINT "Task_sprintTargetId_fkey"                TO "Task_acquisitionTargetId_fkey";
ALTER TABLE "Document"                   RENAME CONSTRAINT "Document_sprintTargetId_fkey"            TO "Document_acquisitionTargetId_fkey";

-- ─── 4) Indizes ─────────────────────────────────────────────────────────────
ALTER INDEX "SprintBlocklist_normalizedName_idx"              RENAME TO "AcquisitionBlocklist_normalizedName_idx";
ALTER INDEX "SprintOffer_offerNumber_key"                     RENAME TO "AcquisitionOffer_offerNumber_key";
ALTER INDEX "SprintOffer_sprintTargetId_idx"                  RENAME TO "AcquisitionOffer_acquisitionTargetId_idx";
ALTER INDEX "SprintOfferItem_offerId_idx"                     RENAME TO "AcquisitionOfferItem_offerId_idx";
ALTER INDEX "SprintBafaDocument_sprintTargetId_idx"           RENAME TO "AcquisitionBafaDocument_acquisitionTargetId_idx";
ALTER INDEX "SprintHandover_sprintTargetId_key"               RENAME TO "AcquisitionHandover_acquisitionTargetId_key";
ALTER INDEX "SprintOutreachTemplate_channel_idx"              RENAME TO "AcquisitionOutreachTemplate_channel_idx";
ALTER INDEX "SprintTargetContact_sprintTargetId_idx"          RENAME TO "AcquisitionTargetContact_acquisitionTargetId_idx";
ALTER INDEX "SprintRegion_bundesland_key"                     RENAME TO "AcquisitionRegion_bundesland_key";
ALTER INDEX "SprintWzMapping_wzCode_key"                      RENAME TO "AcquisitionWzMapping_wzCode_key";
ALTER INDEX "SprintPackageInfo_key_key"                       RENAME TO "AcquisitionPackageInfo_key_key";
ALTER INDEX "SprintPackageService_package_serviceId_key"      RENAME TO "AcquisitionPackageService_package_serviceId_key";
ALTER INDEX "SprintPackageService_package_idx"                RENAME TO "AcquisitionPackageService_package_idx";
ALTER INDEX "SprintSegment_name_key"                          RENAME TO "AcquisitionSegment_name_key";
ALTER INDEX "SprintAssignment_sprintTargetId_userId_role_key" RENAME TO "AcquisitionAssignment_acquisitionTargetId_userId_role_key";
ALTER INDEX "SprintAssignment_userId_idx"                     RENAME TO "AcquisitionAssignment_userId_idx";
ALTER INDEX "SprintAssignment_sprintTargetId_idx"             RENAME TO "AcquisitionAssignment_acquisitionTargetId_idx";
ALTER INDEX "SprintTargetRole_sprintTargetId_role_key"        RENAME TO "AcquisitionTargetRole_acquisitionTargetId_role_key";
ALTER INDEX "SprintTargetRole_sprintTargetId_idx"             RENAME TO "AcquisitionTargetRole_acquisitionTargetId_idx";
ALTER INDEX "Task_sprintTargetId_idx"                         RENAME TO "Task_acquisitionTargetId_idx";
ALTER INDEX "Document_sprintTargetId_idx"                     RENAME TO "Document_acquisitionTargetId_idx";
