/*
  Warnings:

  - A unique constraint covering the columns `[workshopId,id]` on the table `WorkshopOccurrence` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "WorkshopOccurrence_workshopId_id_key" ON "WorkshopOccurrence"("workshopId", "id");
