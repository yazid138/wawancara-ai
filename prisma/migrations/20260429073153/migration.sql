/*
  Warnings:

  - The values [BEHAVIORAL] on the enum `QuestionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `ScoreAnswer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ScoringComponent` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `categoryId` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "QuestionType_new" AS ENUM ('INTRO', 'GENERAL', 'TECHNICAL', 'SOFTSKILL');
ALTER TABLE "public"."Question" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Question" ALTER COLUMN "type" TYPE "QuestionType_new" USING ("type"::text::"QuestionType_new");
ALTER TYPE "QuestionType" RENAME TO "QuestionType_old";
ALTER TYPE "QuestionType_new" RENAME TO "QuestionType";
DROP TYPE "public"."QuestionType_old";
ALTER TABLE "Question" ALTER COLUMN "type" SET DEFAULT 'GENERAL';
COMMIT;

-- DropForeignKey
ALTER TABLE "ScoreAnswer" DROP CONSTRAINT "ScoreAnswer_answerId_fkey";

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "currentIndex" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "categoryId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "ScoreAnswer";

-- DropTable
DROP TABLE "ScoringComponent";

-- CreateTable
CREATE TABLE "QuestionCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerCategory" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "AnswerCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreTechnical" (
    "id" SERIAL NOT NULL,
    "answerId" INTEGER NOT NULL,
    "rubricScore" DOUBLE PRECISION NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "keywordScore" DOUBLE PRECISION NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "breakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreTechnical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreSoftSkill" (
    "id" SERIAL NOT NULL,
    "answerId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "categoryLabel" TEXT NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreSoftSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoreTechnical_answerId_key" ON "ScoreTechnical"("answerId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreSoftSkill_answerId_key" ON "ScoreSoftSkill"("answerId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE INDEX "Answer_interviewId_idx" ON "Answer"("interviewId");

-- CreateIndex
CREATE INDEX "Question_categoryId_idx" ON "Question"("categoryId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "QuestionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerCategory" ADD CONSTRAINT "AnswerCategory_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreTechnical" ADD CONSTRAINT "ScoreTechnical_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreSoftSkill" ADD CONSTRAINT "ScoreSoftSkill_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreSoftSkill" ADD CONSTRAINT "ScoreSoftSkill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AnswerCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
