-- AlterTable
ALTER TABLE "UserMembershipPayment" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePaymentMethodId" TEXT;
