-- AlterTable
ALTER TABLE "IdealAnswer" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceAnswerId" INTEGER;

-- AddForeignKey
ALTER TABLE "IdealAnswer" ADD CONSTRAINT "IdealAnswer_sourceAnswerId_fkey" FOREIGN KEY ("sourceAnswerId") REFERENCES "Answer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
