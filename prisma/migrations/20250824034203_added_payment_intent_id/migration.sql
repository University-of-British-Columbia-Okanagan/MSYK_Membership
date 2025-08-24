-- AlterTable
ALTER TABLE "EquipmentBooking" ADD COLUMN     "paymentIntentId" TEXT;

-- AlterTable
ALTER TABLE "UserMembership" ADD COLUMN     "paymentIntentId" TEXT;

-- AlterTable
ALTER TABLE "UserWorkshop" ADD COLUMN     "paymentIntentId" TEXT;
