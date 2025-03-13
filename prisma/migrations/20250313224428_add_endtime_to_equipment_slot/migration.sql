/*
  Warnings:

  - Added the required column `endTime` to the `EquipmentSlot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Step 1: Add `endTime` as a NULLABLE column first
ALTER TABLE "EquipmentSlot" ADD COLUMN "endTime" TIMESTAMP;

-- Step 2: Update existing rows with `endTime` set to 30 minutes after `startTime`
UPDATE "EquipmentSlot"
SET "endTime" = "startTime" + INTERVAL '30 minutes'
WHERE "endTime" IS NULL;

-- Step 3: Make `endTime` a NOT NULL column
ALTER TABLE "EquipmentSlot" ALTER COLUMN "endTime" SET NOT NULL;

