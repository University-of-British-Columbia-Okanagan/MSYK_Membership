/*
  Warnings:

  - Made the column `address` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `dataPrivacy` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `emergencyContactEmail` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `emergencyContactName` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `emergencyContactPhone` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `guardianSignedConsent` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `over18` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `parentGuardianEmail` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `parentGuardianName` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `parentGuardianPhone` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `photoRelease` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "address" SET NOT NULL,
ALTER COLUMN "dataPrivacy" SET NOT NULL,
ALTER COLUMN "emergencyContactEmail" SET NOT NULL,
ALTER COLUMN "emergencyContactName" SET NOT NULL,
ALTER COLUMN "emergencyContactPhone" SET NOT NULL,
ALTER COLUMN "guardianSignedConsent" SET NOT NULL,
ALTER COLUMN "over18" SET NOT NULL,
ALTER COLUMN "parentGuardianEmail" SET NOT NULL,
ALTER COLUMN "parentGuardianName" SET NOT NULL,
ALTER COLUMN "parentGuardianPhone" SET NOT NULL,
ALTER COLUMN "phone" SET NOT NULL,
ALTER COLUMN "photoRelease" SET NOT NULL;
