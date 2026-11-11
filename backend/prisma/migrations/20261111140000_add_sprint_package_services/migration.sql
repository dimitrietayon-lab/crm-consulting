-- Leistungen (Dienstkatalog), die in einem Paket enthalten sind – mit Umfang (Menge)

CREATE TABLE IF NOT EXISTS "SprintPackageService" (
    "id" TEXT NOT NULL,
    "package" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintPackageService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SprintPackageService_package_serviceId_key"
    ON "SprintPackageService"("package", "serviceId");

CREATE INDEX IF NOT EXISTS "SprintPackageService_package_idx"
    ON "SprintPackageService"("package");

ALTER TABLE "SprintPackageService"
    ADD CONSTRAINT "SprintPackageService_package_fkey"
    FOREIGN KEY ("package") REFERENCES "SprintPackageInfo"("key")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SprintPackageService"
    ADD CONSTRAINT "SprintPackageService_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
