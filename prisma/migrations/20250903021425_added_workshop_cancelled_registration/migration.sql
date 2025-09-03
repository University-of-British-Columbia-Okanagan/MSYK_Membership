-- CreateTable
CREATE TABLE "WorkshopCancelledRegistration" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "workshopId" INTEGER NOT NULL,
    "workshopOccurrenceId" INTEGER NOT NULL,
    "priceVariationId" INTEGER,
    "registrationDate" TIMESTAMP(3) NOT NULL,
    "cancellationDate" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopCancelledRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkshopCancelledRegistration_userId_idx" ON "WorkshopCancelledRegistration"("userId");

-- CreateIndex
CREATE INDEX "WorkshopCancelledRegistration_workshopId_idx" ON "WorkshopCancelledRegistration"("workshopId");

-- CreateIndex
CREATE INDEX "WorkshopCancelledRegistration_resolved_idx" ON "WorkshopCancelledRegistration"("resolved");

-- CreateIndex
CREATE INDEX "WorkshopCancelledRegistration_cancellationDate_idx" ON "WorkshopCancelledRegistration"("cancellationDate");

-- AddForeignKey
ALTER TABLE "WorkshopCancelledRegistration" ADD CONSTRAINT "WorkshopCancelledRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopCancelledRegistration" ADD CONSTRAINT "WorkshopCancelledRegistration_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopCancelledRegistration" ADD CONSTRAINT "WorkshopCancelledRegistration_workshopOccurrenceId_fkey" FOREIGN KEY ("workshopOccurrenceId") REFERENCES "WorkshopOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopCancelledRegistration" ADD CONSTRAINT "WorkshopCancelledRegistration_priceVariationId_fkey" FOREIGN KEY ("priceVariationId") REFERENCES "WorkshopPriceVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
