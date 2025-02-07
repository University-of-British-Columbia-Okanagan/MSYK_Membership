/*
  Warnings:

  - You are about to drop the column `roleUser` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "roleUser",
ADD COLUMN     "roleUserId" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleUserId_fkey" FOREIGN KEY ("roleUserId") REFERENCES "RoleUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
