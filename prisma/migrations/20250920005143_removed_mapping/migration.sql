/*
  Warnings:

  - You are about to drop the `user_membership_forms` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_membership_forms" DROP CONSTRAINT "user_membership_forms_membershipPlanId_fkey";

-- DropForeignKey
ALTER TABLE "user_membership_forms" DROP CONSTRAINT "user_membership_forms_userId_fkey";

-- DropTable
DROP TABLE "user_membership_forms";

-- CreateTable
CREATE TABLE "UserMembershipForm" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "membershipPlanId" INTEGER NOT NULL,
    "agreementSignature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMembershipForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserMembershipForm_userId_membershipPlanId_key" ON "UserMembershipForm"("userId", "membershipPlanId");

-- AddForeignKey
ALTER TABLE "UserMembershipForm" ADD CONSTRAINT "UserMembershipForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMembershipForm" ADD CONSTRAINT "UserMembershipForm_membershipPlanId_fkey" FOREIGN KEY ("membershipPlanId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
