/*
  Warnings:

  - You are about to drop the column `over18` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `parentGuardianEmail` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `parentGuardianName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `parentGuardianPhone` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `photoRelease` on the `User` table. All the data in the column will be lost.
  - Added the required column `communityGuidelines` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateOfBirth` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mediaConsent` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `operationsPolicy` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "over18",
DROP COLUMN "parentGuardianEmail",
DROP COLUMN "parentGuardianName",
DROP COLUMN "parentGuardianPhone",
DROP COLUMN "photoRelease",
ADD COLUMN     "communityGuidelines" BOOLEAN NOT NULL,
ADD COLUMN     "dateOfBirth" TEXT NOT NULL,
ADD COLUMN     "mediaConsent" BOOLEAN NOT NULL,
ADD COLUMN     "operationsPolicy" BOOLEAN NOT NULL;
