/*
  Warnings:

  - You are about to drop the `UserMembershipPayment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserMembershipPayment" DROP CONSTRAINT "UserMembershipPayment_userId_fkey";

-- DropTable
DROP TABLE "UserMembershipPayment";
