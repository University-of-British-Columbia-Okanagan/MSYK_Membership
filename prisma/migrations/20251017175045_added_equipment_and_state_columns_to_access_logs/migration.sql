/*
  Warnings:

  - Added the required column `equipment` to the `AccessLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `AccessLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AccessLog" ADD COLUMN     "equipment" TEXT NOT NULL,
ADD COLUMN     "state" TEXT NOT NULL;
