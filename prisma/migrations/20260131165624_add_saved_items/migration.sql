-- CreateTable
CREATE TABLE "SavedThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedComment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedThread_userId_idx" ON "SavedThread"("userId");

-- CreateIndex
CREATE INDEX "SavedThread_threadId_idx" ON "SavedThread"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedThread_userId_threadId_key" ON "SavedThread"("userId", "threadId");

-- CreateIndex
CREATE INDEX "SavedComment_userId_idx" ON "SavedComment"("userId");

-- CreateIndex
CREATE INDEX "SavedComment_commentId_idx" ON "SavedComment"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedComment_userId_commentId_key" ON "SavedComment"("userId", "commentId");

-- AddForeignKey
ALTER TABLE "SavedThread" ADD CONSTRAINT "SavedThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedThread" ADD CONSTRAINT "SavedThread_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedComment" ADD CONSTRAINT "SavedComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedComment" ADD CONSTRAINT "SavedComment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
