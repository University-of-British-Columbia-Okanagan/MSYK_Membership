-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PaymentFulfillment" (
    "id" SERIAL NOT NULL,
    "stripeRef" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentCheckout" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "slots" JSONB NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentFulfillment_stripeRef_key" ON "PaymentFulfillment"("stripeRef");

-- CreateIndex
CREATE INDEX "PaymentFulfillment_userId_idx" ON "PaymentFulfillment"("userId");

-- CreateIndex
CREATE INDEX "EquipmentCheckout_userId_idx" ON "EquipmentCheckout"("userId");

-- AddForeignKey
ALTER TABLE "PaymentFulfillment" ADD CONSTRAINT "PaymentFulfillment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentCheckout" ADD CONSTRAINT "EquipmentCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentCheckout" ADD CONSTRAINT "EquipmentCheckout_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
