/*
  Warnings:

  - You are about to drop the column `prerequisites` on the `Workshop` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Workshop" DROP COLUMN "prerequisites";

-- CreateTable
CREATE TABLE "WorkshopPrerequisite" (
    "id" SERIAL NOT NULL,
    "workshopId" INTEGER NOT NULL,
    "prerequisiteId" INTEGER NOT NULL,

    CONSTRAINT "WorkshopPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopPrerequisite_workshopId_prerequisiteId_key" ON "WorkshopPrerequisite"("workshopId", "prerequisiteId");

-- AddForeignKey
ALTER TABLE "WorkshopPrerequisite" ADD CONSTRAINT "WorkshopPrerequisite_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopPrerequisite" ADD CONSTRAINT "WorkshopPrerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
