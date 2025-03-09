-- CreateTable
CREATE TABLE "WorkshopEquipment" (
    "id" SERIAL NOT NULL,
    "workshopId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,

    CONSTRAINT "WorkshopEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopEquipment_workshopId_equipmentId_key" ON "WorkshopEquipment"("workshopId", "equipmentId");

-- AddForeignKey
ALTER TABLE "WorkshopEquipment" ADD CONSTRAINT "WorkshopEquipment_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopEquipment" ADD CONSTRAINT "WorkshopEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
