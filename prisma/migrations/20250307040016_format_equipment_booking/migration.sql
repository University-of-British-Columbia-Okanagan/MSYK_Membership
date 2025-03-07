-- DropForeignKey
ALTER TABLE "EquipmentBooking" DROP CONSTRAINT "EquipmentBooking_slotId_fkey";

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "EquipmentSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
