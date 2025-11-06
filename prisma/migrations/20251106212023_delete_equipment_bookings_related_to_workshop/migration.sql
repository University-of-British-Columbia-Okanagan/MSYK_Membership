-- DropForeignKey
ALTER TABLE "EquipmentBooking" DROP CONSTRAINT "EquipmentBooking_workshopId_fkey";

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
