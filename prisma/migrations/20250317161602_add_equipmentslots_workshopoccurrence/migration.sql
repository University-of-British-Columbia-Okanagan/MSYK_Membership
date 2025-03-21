/*
  Warnings:

  - You are about to drop the column `workshopId` on the `EquipmentSlot` table. All the data in the column will be lost.
  - You are about to drop the column `equipmentId` on the `WorkshopOccurrence` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "EquipmentSlot" DROP CONSTRAINT "EquipmentSlot_workshopId_fkey";

-- AlterTable
ALTER TABLE "EquipmentSlot" DROP COLUMN "workshopId",
ADD COLUMN     "workshopOccurrenceId" INTEGER;

-- AlterTable
ALTER TABLE "WorkshopOccurrence" DROP COLUMN "equipmentId";

-- AddForeignKey
ALTER TABLE "EquipmentSlot" ADD CONSTRAINT "EquipmentSlot_workshopOccurrenceId_fkey" FOREIGN KEY ("workshopOccurrenceId") REFERENCES "WorkshopOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
