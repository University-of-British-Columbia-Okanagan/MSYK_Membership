/*
  Warnings:

  - A unique constraint covering the columns `[slotId]` on the table `EquipmentBooking` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "EquipmentBooking_userId_slotId_key";

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentBooking_slotId_key" ON "EquipmentBooking"("slotId");
