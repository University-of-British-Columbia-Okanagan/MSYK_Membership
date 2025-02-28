-- AlterTable
ALTER TABLE "WorkshopOccurrence" ADD COLUMN     "equipmentId" INTEGER;

-- AddForeignKey
ALTER TABLE "WorkshopOccurrence" ADD CONSTRAINT "WorkshopOccurrence_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
