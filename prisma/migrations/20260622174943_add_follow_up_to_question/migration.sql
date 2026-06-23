-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'ANSWERED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "expectedSignal" TEXT,
ADD COLUMN     "followUpReason" TEXT,
ADD COLUMN     "followUpStatus" "FollowUpStatus",
ADD COLUMN     "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentAnswerId" INTEGER;

-- CreateIndex
CREATE INDEX "Question_parentAnswerId_idx" ON "Question"("parentAnswerId");

-- CreateIndex
CREATE INDEX "Question_isFollowUp_idx" ON "Question"("isFollowUp");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_parentAnswerId_fkey" FOREIGN KEY ("parentAnswerId") REFERENCES "Answer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
