-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "stripeProductId" TEXT;

-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "stripeProductId" TEXT;

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "stripeProductId" TEXT;
