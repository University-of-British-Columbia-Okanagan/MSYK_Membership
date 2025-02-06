/*
  Warnings:

  - You are about to drop the column `subtitle` on the `MembershipPlan` table. All the data in the column will be lost.
  - Added the required column `feature` to the `MembershipPlan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MembershipPlan" DROP COLUMN "subtitle",
ADD COLUMN     "feature" JSONB NOT NULL,
ALTER COLUMN "description" SET DATA TYPE TEXT;
