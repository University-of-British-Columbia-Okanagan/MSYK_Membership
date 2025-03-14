-- AlterTable
ALTER TABLE "EquipmentSlot" ADD COLUMN     "workshopId" INTEGER;

-- AddForeignKey
ALTER TABLE "EquipmentSlot" ADD CONSTRAINT "EquipmentSlot_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
