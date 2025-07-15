-- CreateTable
CREATE TABLE "VolunteerTimetable" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerTimetable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolunteerTimetable_userId_idx" ON "VolunteerTimetable"("userId");

-- CreateIndex
CREATE INDEX "VolunteerTimetable_startTime_idx" ON "VolunteerTimetable"("startTime");

-- AddForeignKey
ALTER TABLE "VolunteerTimetable" ADD CONSTRAINT "VolunteerTimetable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
