/*
  Warnings:

  - Made the column `description` on table `VolunteerTimetable` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "VolunteerTimetable" ALTER COLUMN "description" SET NOT NULL;
