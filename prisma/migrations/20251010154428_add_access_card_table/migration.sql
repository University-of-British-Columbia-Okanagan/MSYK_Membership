-- CreateTable
CREATE TABLE "AccessCard" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "permissions" INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessCard_userId_idx" ON "AccessCard"("userId");

-- AddForeignKey
ALTER TABLE "AccessCard" ADD CONSTRAINT "AccessCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
