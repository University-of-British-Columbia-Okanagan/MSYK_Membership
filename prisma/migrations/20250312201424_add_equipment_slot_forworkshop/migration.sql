/*
  Warnings:

  - You are about to drop the `WorkshopEquipment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WorkshopEquipment" DROP CONSTRAINT "WorkshopEquipment_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "WorkshopEquipment" DROP CONSTRAINT "WorkshopEquipment_workshopId_fkey";

-- DropForeignKey
ALTER TABLE "WorkshopOccurrence" DROP CONSTRAINT "WorkshopOccurrence_equipmentId_fkey";

-- DropTable
DROP TABLE "WorkshopEquipment";
