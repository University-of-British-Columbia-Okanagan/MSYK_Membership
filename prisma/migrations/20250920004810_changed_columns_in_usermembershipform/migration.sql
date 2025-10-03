/*
  Warnings:

  - You are about to drop the column `membershipId` on the `user_membership_forms` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,membershipPlanId]` on the table `user_membership_forms` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `membershipPlanId` to the `user_membership_forms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `user_membership_forms` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "user_membership_forms" DROP COLUMN "membershipId",
ADD COLUMN     "membershipPlanId" INTEGER NOT NULL,
ADD COLUMN     "userId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_membership_forms_userId_membershipPlanId_key" ON "user_membership_forms"("userId", "membershipPlanId");

-- AddForeignKey
ALTER TABLE "user_membership_forms" ADD CONSTRAINT "user_membership_forms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_membership_forms" ADD CONSTRAINT "user_membership_forms_membershipPlanId_fkey" FOREIGN KEY ("membershipPlanId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
