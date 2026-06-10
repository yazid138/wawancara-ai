-- CreateTable
CREATE TABLE "FocusQuestion" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FocusQuestion_categoryId_idx" ON "FocusQuestion"("categoryId");

-- CreateIndex
CREATE INDEX "FocusQuestion_userId_idx" ON "FocusQuestion"("userId");

-- AddForeignKey
ALTER TABLE "FocusQuestion" ADD CONSTRAINT "FocusQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "QuestionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusQuestion" ADD CONSTRAINT "FocusQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
