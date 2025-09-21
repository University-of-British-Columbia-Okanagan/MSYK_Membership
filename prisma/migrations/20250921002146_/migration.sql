-- DropIndex
DROP INDEX "UserMembershipForm_userId_membershipPlanId_key";

-- AlterTable
ALTER TABLE "UserMembershipForm" ALTER COLUMN "status" SET DEFAULT 'pending';
