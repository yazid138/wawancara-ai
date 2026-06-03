-- AlterTable
ALTER TABLE "IdealAnswer" ADD COLUMN     "answerCategoryId" INTEGER;

-- AddForeignKey
ALTER TABLE "IdealAnswer" ADD CONSTRAINT "IdealAnswer_answerCategoryId_fkey" FOREIGN KEY ("answerCategoryId") REFERENCES "AnswerCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
