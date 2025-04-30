-- CreateTable
CREATE TABLE "UserPaymentInformation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "stripeCustomerId" TEXT,
    "stripePaymentMethodId" TEXT,
    "cardholderName" TEXT,
    "cardLast4" TEXT,
    "cardExpiry" TEXT,
    "expMonth" INTEGER,
    "expYear" INTEGER,
    "billingAddressLine1" TEXT,
    "billingAddressLine2" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingZip" TEXT,
    "billingCountry" TEXT,
    "email" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPaymentInformation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPaymentInformation_userId_key" ON "UserPaymentInformation"("userId");

-- CreateIndex
CREATE INDEX "UserPaymentInformation_userId_idx" ON "UserPaymentInformation"("userId");

-- CreateIndex
CREATE INDEX "UserPaymentInformation_stripeCustomerId_idx" ON "UserPaymentInformation"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "UserPaymentInformation" ADD CONSTRAINT "UserPaymentInformation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
