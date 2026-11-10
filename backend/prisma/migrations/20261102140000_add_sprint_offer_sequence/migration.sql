-- Atomare Angebotsnummern: SP-<Jahr>-<0001>
CREATE TABLE "SprintOfferSequence" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SprintOfferSequence_pkey" PRIMARY KEY ("year")
);
