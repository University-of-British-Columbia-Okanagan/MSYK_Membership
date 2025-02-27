-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "prerequisites" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
