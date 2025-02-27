/*
  Warnings:

  - Added the required column `accessHours` to the `MembershipPlan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "accessHours" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "Equipment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "availability" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentBooking" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "EquipmentBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_name_key" ON "Equipment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentBooking_equipmentId_startTime_key" ON "EquipmentBooking"("equipmentId", "startTime");

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
