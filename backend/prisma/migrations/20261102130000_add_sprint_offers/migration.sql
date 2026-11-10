-- Angebote mit Positionen
CREATE TABLE "SprintOffer" (
    "id" TEXT NOT NULL,
    "offerNumber" TEXT NOT NULL,
    "sprintTargetId" TEXT NOT NULL,
    "package" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SprintOffer_offerNumber_key" ON "SprintOffer"("offerNumber");
CREATE INDEX "SprintOffer_sprintTargetId_idx" ON "SprintOffer"("sprintTargetId");

CREATE TABLE "SprintOfferItem" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "SprintOfferItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SprintOfferItem_offerId_idx" ON "SprintOfferItem"("offerId");

ALTER TABLE "SprintOffer" ADD CONSTRAINT "SprintOffer_sprintTargetId_fkey" FOREIGN KEY ("sprintTargetId") REFERENCES "SprintTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SprintOfferItem" ADD CONSTRAINT "SprintOfferItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SprintOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
