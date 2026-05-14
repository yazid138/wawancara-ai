-- DropForeignKey
ALTER TABLE "ScoreSoftSkill" DROP CONSTRAINT "ScoreSoftSkill_categoryId_fkey";

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "resume" TEXT;

-- AlterTable
ALTER TABLE "ScoreSoftSkill" ALTER COLUMN "categoryId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ScoreSoftSkill" ADD CONSTRAINT "ScoreSoftSkill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AnswerCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
