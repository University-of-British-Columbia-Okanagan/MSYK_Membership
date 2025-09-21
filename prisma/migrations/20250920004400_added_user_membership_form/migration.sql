-- CreateTable
CREATE TABLE "user_membership_forms" (
    "id" SERIAL NOT NULL,
    "membershipId" INTEGER NOT NULL,
    "agreementSignature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_membership_forms_pkey" PRIMARY KEY ("id")
);
