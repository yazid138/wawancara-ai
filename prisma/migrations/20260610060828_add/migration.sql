/*
  Warnings:

  - Added the required column `interviewId` to the `FocusQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FocusQuestion" ADD COLUMN     "interviewId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "FocusQuestion_interviewId_idx" ON "FocusQuestion"("interviewId");

-- AddForeignKey
ALTER TABLE "FocusQuestion" ADD CONSTRAINT "FocusQuestion_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
