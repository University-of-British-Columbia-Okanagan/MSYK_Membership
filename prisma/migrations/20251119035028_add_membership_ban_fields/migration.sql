-- AlterTable
ALTER TABLE "User" ADD COLUMN     "membershipRevokedAt" TIMESTAMP(3),
ADD COLUMN     "membershipRevokedReason" TEXT,
ADD COLUMN     "membershipStatus" TEXT NOT NULL DEFAULT 'active';
