-- DropForeignKey
ALTER TABLE "EquipmentSlot" DROP CONSTRAINT "EquipmentSlot_workshopOccurrenceId_fkey";

-- AddForeignKey
ALTER TABLE "EquipmentSlot" ADD CONSTRAINT "EquipmentSlot_workshopOccurrenceId_fkey" FOREIGN KEY ("workshopOccurrenceId") REFERENCES "WorkshopOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
