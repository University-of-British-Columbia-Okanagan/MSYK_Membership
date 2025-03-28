/*
  Warnings:

  - Made the column `nextPaymentDate` on table `UserMembership` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "UserMembership" ALTER COLUMN "nextPaymentDate" SET NOT NULL;
