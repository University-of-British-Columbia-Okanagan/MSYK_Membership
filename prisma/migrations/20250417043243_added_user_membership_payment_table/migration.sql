-- CreateTable
CREATE TABLE "UserMembershipPayment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "membershipPlanId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "expMonth" TEXT NOT NULL,
    "expYear" TEXT NOT NULL,
    "cvc" TEXT NOT NULL,
    "cardholderName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,

    CONSTRAINT "UserMembershipPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMembershipPayment_userId_idx" ON "UserMembershipPayment"("userId");

-- AddForeignKey
ALTER TABLE "UserMembershipPayment" ADD CONSTRAINT "UserMembershipPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
