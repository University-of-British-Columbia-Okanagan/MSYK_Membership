/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `UserMembership` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserMembership_userId_key" ON "UserMembership"("userId");
