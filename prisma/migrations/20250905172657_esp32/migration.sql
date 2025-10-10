/*
  Warnings:

  - A unique constraint covering the columns `[passcode]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `passcode` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cncCertified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "equipmentCertified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "millCertified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passcode" INTEGER NOT NULL,
ADD COLUMN     "welderCertified" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "passcodeUsed" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'granted',
    "method" TEXT,
    "ipAddress" TEXT,
    "location" TEXT,
    "notes" TEXT,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessLog_userId_idx" ON "AccessLog"("userId");

-- CreateIndex
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_passcodeUsed_idx" ON "AccessLog"("passcodeUsed");

-- CreateIndex
CREATE UNIQUE INDEX "User_passcode_key" ON "User"("passcode");

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
