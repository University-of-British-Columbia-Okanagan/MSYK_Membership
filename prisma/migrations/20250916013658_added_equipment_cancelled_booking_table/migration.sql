-- CreateTable
CREATE TABLE "EquipmentCancelledBooking" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "paymentIntentId" TEXT,
    "totalSlotsBooked" INTEGER NOT NULL,
    "slotsRefunded" INTEGER NOT NULL,
    "totalPricePaid" DOUBLE PRECISION NOT NULL,
    "priceToRefund" DOUBLE PRECISION NOT NULL,
    "cancellationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eligibleForRefund" BOOLEAN NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "cancelledSlotTimes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentCancelledBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentCancelledBooking_userId_idx" ON "EquipmentCancelledBooking"("userId");

-- CreateIndex
CREATE INDEX "EquipmentCancelledBooking_equipmentId_idx" ON "EquipmentCancelledBooking"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentCancelledBooking_paymentIntentId_idx" ON "EquipmentCancelledBooking"("paymentIntentId");

-- AddForeignKey
ALTER TABLE "EquipmentCancelledBooking" ADD CONSTRAINT "EquipmentCancelledBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentCancelledBooking" ADD CONSTRAINT "EquipmentCancelledBooking_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
