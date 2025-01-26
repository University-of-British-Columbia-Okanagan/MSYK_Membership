/*
  Warnings:

  - Made the column `trainingCardUserNumber` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "guardianSignedConsent" DROP NOT NULL,
ALTER COLUMN "parentGuardianEmail" DROP NOT NULL,
ALTER COLUMN "parentGuardianName" DROP NOT NULL,
ALTER COLUMN "parentGuardianPhone" DROP NOT NULL,
ALTER COLUMN "trainingCardUserNumber" SET NOT NULL;
