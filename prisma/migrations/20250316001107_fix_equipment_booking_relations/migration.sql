/*
  Warnings:

  - A unique constraint covering the columns `[userId,slotId]` on the table `EquipmentBooking` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Equipment_name_key";

-- DropIndex
DROP INDEX "EquipmentBooking_slotId_key";

-- AlterTable
ALTER TABLE "Equipment" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "price" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EquipmentSlot" ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentBooking_userId_slotId_key" ON "EquipmentBooking"("userId", "slotId");
