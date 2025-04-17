/*
  Warnings:

  - You are about to drop the column `compensationPrice` on the `UserMembership` table. All the data in the column will be lost.
  - You are about to drop the column `hasPaidCompensationPrice` on the `UserMembership` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserMembership" DROP COLUMN "compensationPrice",
DROP COLUMN "hasPaidCompensationPrice";
