/*
  Warnings:

  - You are about to drop the column `prerequisiteId` on the `EquipmentPrerequisite` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[equipmentId,workshopPrerequisiteId]` on the table `EquipmentPrerequisite` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `workshopPrerequisiteId` to the `EquipmentPrerequisite` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "EquipmentPrerequisite" DROP CONSTRAINT "EquipmentPrerequisite_prerequisiteId_fkey";

-- DropIndex
DROP INDEX "EquipmentPrerequisite_equipmentId_prerequisiteId_key";

-- AlterTable
ALTER TABLE "EquipmentPrerequisite" DROP COLUMN "prerequisiteId",
ADD COLUMN     "workshopPrerequisiteId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentPrerequisite_equipmentId_workshopPrerequisiteId_key" ON "EquipmentPrerequisite"("equipmentId", "workshopPrerequisiteId");

-- AddForeignKey
ALTER TABLE "EquipmentPrerequisite" ADD CONSTRAINT "EquipmentPrerequisite_workshopPrerequisiteId_fkey" FOREIGN KEY ("workshopPrerequisiteId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
