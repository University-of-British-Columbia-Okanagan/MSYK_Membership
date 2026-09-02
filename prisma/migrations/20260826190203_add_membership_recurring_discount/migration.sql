-- AlterTable
ALTER TABLE "UserMembership" ADD COLUMN     "discountEndsAt" TIMESTAMP(3),
ADD COLUMN     "stripeCouponId" TEXT;
