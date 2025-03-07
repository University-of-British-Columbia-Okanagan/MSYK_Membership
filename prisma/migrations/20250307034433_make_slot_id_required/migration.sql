/*
  Warnings:

  - Made the column `slotId` on table `EquipmentBooking` required. This step will fail if there are existing NULL values in that column.

*/
UPDATE "EquipmentBooking"
SET "slotId" = (SELECT "id" FROM "EquipmentSlot" 
                WHERE "EquipmentSlot"."equipmentId" = "EquipmentBooking"."equipmentId"
                LIMIT 1)
WHERE "slotId" IS NULL;

-- AlterTable
ALTER TABLE "EquipmentBooking" ALTER COLUMN "slotId" SET NOT NULL;
