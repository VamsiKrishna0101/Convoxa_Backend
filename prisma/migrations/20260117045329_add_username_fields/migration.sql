/*
  This migration adds the username column to Comment, CommunityMember, Reply, and Thread tables.
  It handles existing rows by populating username from the related User table.
*/

-- Step 1: Add columns as nullable first
ALTER TABLE "Comment" ADD COLUMN "username" TEXT;
ALTER TABLE "CommunityMember" ADD COLUMN "username" TEXT;
ALTER TABLE "Reply" ADD COLUMN "username" TEXT;
ALTER TABLE "Thread" ADD COLUMN "username" TEXT;

-- Step 2: Populate username from User table for existing rows
UPDATE "Comment" SET "username" = (SELECT "username" FROM "User" WHERE "User"."id" = "Comment"."authorId");
UPDATE "CommunityMember" SET "username" = (SELECT "username" FROM "User" WHERE "User"."id" = "CommunityMember"."userId");
UPDATE "Reply" SET "username" = (SELECT "username" FROM "User" WHERE "User"."id" = "Reply"."authorId");
UPDATE "Thread" SET "username" = (SELECT "username" FROM "User" WHERE "User"."id" = "Thread"."authorId");

-- Step 3: Make columns NOT NULL after populating data
ALTER TABLE "Comment" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "CommunityMember" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "Reply" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "Thread" ALTER COLUMN "username" SET NOT NULL;
