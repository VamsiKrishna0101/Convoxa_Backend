/*
  Warnings:

  - Made the column `imageUrl` on table `Community` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "Community" ALTER COLUMN "imageUrl" SET NOT NULL;

-- AlterTable
ALTER TABLE "Reply" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "Thread" ADD COLUMN     "imageUrl" TEXT;
