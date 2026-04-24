/*
  Warnings:

  - You are about to drop the column `rule` on the `ScoreSetting` table. All the data in the column will be lost.
  - Added the required column `name` to the `ScoreSetting` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ScoreSetting" DROP COLUMN "rule",
ADD COLUMN     "name" TEXT NOT NULL;
