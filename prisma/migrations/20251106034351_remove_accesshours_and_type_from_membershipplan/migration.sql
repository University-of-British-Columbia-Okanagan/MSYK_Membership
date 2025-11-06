/*
  Warnings:

  - You are about to drop the column `accessHours` on the `MembershipPlan` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `MembershipPlan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MembershipPlan" DROP COLUMN "accessHours",
DROP COLUMN "type";
