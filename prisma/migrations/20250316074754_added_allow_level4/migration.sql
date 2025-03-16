/*
  Warnings:

  - You are about to drop the column `membershipId` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_membershipId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "membershipId",
ADD COLUMN     "allowLevel4" BOOLEAN NOT NULL DEFAULT false;
