-- AlterTable
ALTER TABLE "UserMembership" ADD COLUMN     "compensationPrice" DECIMAL(65,30),
ADD COLUMN     "hasPaidCompensationPrice" BOOLEAN;
