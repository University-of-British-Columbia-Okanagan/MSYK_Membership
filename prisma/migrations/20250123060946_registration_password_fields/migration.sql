/*
  Warnings:

  - Made the column `firstName` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastName` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "dataPrivacy" BOOLEAN,
ADD COLUMN     "emergencyContactEmail" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "guardianSignedConsent" TEXT,
ADD COLUMN     "over18" BOOLEAN,
ADD COLUMN     "parentGuardianEmail" TEXT,
ADD COLUMN     "parentGuardianName" TEXT,
ADD COLUMN     "parentGuardianPhone" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photoRelease" BOOLEAN,
ADD COLUMN     "trainingCardUserNumber" INTEGER,
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;
