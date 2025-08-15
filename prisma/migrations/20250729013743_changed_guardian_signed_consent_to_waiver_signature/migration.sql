/*
  Warnings:

  - You are about to drop the column `guardianSignedConsent` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "guardianSignedConsent",
ADD COLUMN     "waiverSignature" TEXT;
