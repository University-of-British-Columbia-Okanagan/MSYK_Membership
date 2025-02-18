/*
  Warnings:

  - A unique constraint covering the columns `[userId,occurrenceId]` on the table `UserWorkshop` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `occurrenceId` to the `UserWorkshop` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "UserWorkshop_userId_workshopId_key";

-- DropIndex
DROP INDEX "WorkshopOccurrence_workshopId_startDate_endDate_key";

-- AlterTable
ALTER TABLE "UserWorkshop" ADD COLUMN     "occurrenceId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserWorkshop_userId_occurrenceId_key" ON "UserWorkshop"("userId", "occurrenceId");

-- AddForeignKey
ALTER TABLE "UserWorkshop" ADD CONSTRAINT "UserWorkshop_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "WorkshopOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
