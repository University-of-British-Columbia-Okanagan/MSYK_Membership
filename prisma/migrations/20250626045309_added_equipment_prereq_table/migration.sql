-- CreateTable
CREATE TABLE "EquipmentPrerequisite" (
    "id" SERIAL NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "prerequisiteId" INTEGER NOT NULL,

    CONSTRAINT "EquipmentPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentPrerequisite_equipmentId_prerequisiteId_key" ON "EquipmentPrerequisite"("equipmentId", "prerequisiteId");

-- AddForeignKey
ALTER TABLE "EquipmentPrerequisite" ADD CONSTRAINT "EquipmentPrerequisite_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentPrerequisite" ADD CONSTRAINT "EquipmentPrerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
