-- AlterTable
ALTER TABLE "UserMembershipForm" ADD COLUMN     "userMembershipId" INTEGER;

-- AddForeignKey
ALTER TABLE "UserMembershipForm" ADD CONSTRAINT "UserMembershipForm_userMembershipId_fkey" FOREIGN KEY ("userMembershipId") REFERENCES "UserMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
