-- AlterTable
ALTER TABLE "User" ADD COLUMN     "portalRoleId" TEXT;

-- CreateTable
CREATE TABLE "PortalModule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PortalModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalFeature" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "route" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PortalFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalRolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PortalRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalModule_key_key" ON "PortalModule"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PortalFeature_key_key" ON "PortalFeature"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PortalRole_name_key" ON "PortalRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PortalRolePermission_roleId_featureId_key" ON "PortalRolePermission"("roleId", "featureId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_portalRoleId_fkey" FOREIGN KEY ("portalRoleId") REFERENCES "PortalRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalFeature" ADD CONSTRAINT "PortalFeature_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "PortalModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalRolePermission" ADD CONSTRAINT "PortalRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PortalRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalRolePermission" ADD CONSTRAINT "PortalRolePermission_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "PortalFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
