-- CreateTable
CREATE TABLE "Issue" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "reportedById" INTEGER NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueScreenshot" (
    "id" SERIAL NOT NULL,
    "issueId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "IssueScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Issue_reportedById_idx" ON "Issue"("reportedById");

-- CreateIndex
CREATE INDEX "IssueScreenshot_issueId_idx" ON "IssueScreenshot"("issueId");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueScreenshot" ADD CONSTRAINT "IssueScreenshot_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
