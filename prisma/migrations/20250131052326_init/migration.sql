-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "over18" BOOLEAN NOT NULL,
    "parentGuardianName" TEXT,
    "parentGuardianPhone" TEXT,
    "parentGuardianEmail" TEXT,
    "guardianSignedConsent" TEXT,
    "photoRelease" BOOLEAN NOT NULL,
    "dataPrivacy" BOOLEAN NOT NULL,
    "emergencyContactName" TEXT NOT NULL,
    "emergencyContactPhone" TEXT NOT NULL,
    "emergencyContactEmail" TEXT NOT NULL,
    "trainingCardUserNumber" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
