-- AlterTable
ALTER TABLE "ScoreSoftSkill" ADD COLUMN     "prompt" TEXT;

-- AlterTable
ALTER TABLE "ScoreTechnical" ADD COLUMN     "prompt" TEXT,
ADD COLUMN     "reason" TEXT;
