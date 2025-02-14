-- Step 1: Add `type` column with a default value first
ALTER TABLE "Workshop" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'general';

-- Step 2: Drop `eventDate` and `status` columns separately
ALTER TABLE "Workshop" DROP COLUMN "eventDate";
ALTER TABLE "Workshop" DROP COLUMN "status";

-- Step 3: Remove `type` from `UserWorkshop` table
ALTER TABLE "UserWorkshop" DROP COLUMN "type";

-- Step 4: Create the `WorkshopOccurrence` table
CREATE TABLE "WorkshopOccurrence" (
    "id" SERIAL NOT NULL,
    "workshopId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopOccurrence_pkey" PRIMARY KEY ("id")
);

-- Step 5: Add unique index for occurrences
CREATE UNIQUE INDEX "WorkshopOccurrence_workshopId_startDate_endDate_key" 
ON "WorkshopOccurrence"("workshopId", "startDate", "endDate");

-- Step 6: Add foreign key relationship for occurrences
ALTER TABLE "WorkshopOccurrence" ADD CONSTRAINT "WorkshopOccurrence_workshopId_fkey" 
FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
