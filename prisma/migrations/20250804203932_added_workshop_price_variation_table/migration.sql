-- AlterTable
ALTER TABLE "UserWorkshop" ADD COLUMN     "priceVariationId" INTEGER;

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "hasPriceVariations" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WorkshopPriceVariation" (
    "id" SERIAL NOT NULL,
    "workshopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "description" TEXT,

    CONSTRAINT "WorkshopPriceVariation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopPriceVariation_workshopId_name_key" ON "WorkshopPriceVariation"("workshopId", "name");

-- AddForeignKey
ALTER TABLE "UserWorkshop" ADD CONSTRAINT "UserWorkshop_priceVariationId_fkey" FOREIGN KEY ("priceVariationId") REFERENCES "WorkshopPriceVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopPriceVariation" ADD CONSTRAINT "WorkshopPriceVariation_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
