/*
  Warnings:

  - Added the required column `capacity` to the `WorkshopPriceVariation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkshopPriceVariation" ADD COLUMN     "capacity" INTEGER NOT NULL;
