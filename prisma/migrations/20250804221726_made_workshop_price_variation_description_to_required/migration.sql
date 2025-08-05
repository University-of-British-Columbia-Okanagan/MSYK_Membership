/*
  Warnings:

  - Made the column `description` on table `WorkshopPriceVariation` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "WorkshopPriceVariation" ALTER COLUMN "description" SET NOT NULL;
