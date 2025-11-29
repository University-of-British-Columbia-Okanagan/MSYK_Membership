/*
  Warnings:

  - A unique constraint covering the columns `[brivoCredentialId]` on the table `AccessCard` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[brivoMobilePassId]` on the table `AccessCard` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[brivoPersonId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AccessCard" ADD COLUMN     "brivoCredentialId" TEXT,
ADD COLUMN     "brivoMobilePassId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "brivoLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "brivoPersonId" TEXT,
ADD COLUMN     "brivoSyncError" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AccessCard_brivoCredentialId_key" ON "AccessCard"("brivoCredentialId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCard_brivoMobilePassId_key" ON "AccessCard"("brivoMobilePassId");

-- CreateIndex
CREATE UNIQUE INDEX "User_brivoPersonId_key" ON "User"("brivoPersonId");
