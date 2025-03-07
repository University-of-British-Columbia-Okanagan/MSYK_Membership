/*
  Warnings:

  - You are about to drop the column `endTime` on the `EquipmentBooking` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `EquipmentBooking` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slotId]` on the table `EquipmentBooking` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slotId` to the `EquipmentBooking` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "EquipmentBooking_equipmentId_startTime_key";

-- AlterTable
-- AlterTable
ALTER TABLE "EquipmentBooking"
DROP COLUMN "endTime",
DROP COLUMN "startTime",
ADD COLUMN "slotId" INTEGER;


-- CreateTable
CREATE TABLE "EquipmentSlot" (
    "id" SERIAL NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EquipmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentSlot_startTime_key" ON "EquipmentSlot"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentBooking_slotId_key" ON "EquipmentBooking"("slotId");

-- AddForeignKey
ALTER TABLE "EquipmentSlot" ADD CONSTRAINT "EquipmentSlot_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "EquipmentSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
