import prisma from "../../config/prisma.js";


export class SavedService {
    // THREADS
    static async saveThread(userId: string, threadId: string) {
        // Check if already saved
        const existing = await prisma.savedThread.findUnique({
            where: {
                userId_threadId: { userId, threadId }
            }
        });

        if (existing) {
            return { success: true, message: "Thread already saved" };
        }

        await prisma.savedThread.create({
            data: { userId, threadId }
        });

        return { success: true, message: "Thread saved successfully" };
    }

    static async removeSavedThread(userId: string, threadId: string) {
        try {
            await prisma.savedThread.delete({
                where: {
                    userId_threadId: { userId, threadId }
                }
            });
            return { success: true, message: "Thread removed from saved" };
        } catch (error) {
            // handle case where it didn't exist
            return { success: false, message: "Saved thread not found" };
        }
    }

    static async getSavedThreads(userId: string) {
        return await prisma.savedThread.findMany({
            where: { userId },
            include: {
                thread: {
                    include: {
                        community: true,
                        author: { select: { id: true, username: true, role: true } },
                        _count: { select: { comments: true, votes: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    // COMMENTS
    static async saveComment(userId: string, commentId: string) {
        // First, check if this is a Comment or a Reply to handle foreign keys correctly
        const comment = await prisma.comment.findUnique({ where: { id: commentId } });
        const isReply = !comment;

        if (isReply) {
            const reply = await prisma.reply.findUnique({ where: { id: commentId } });
            if (!reply) throw new Error("COMMENT_NOT_FOUND");

            const existing = await prisma.savedComment.findUnique({
                where: { userId_replyId: { userId, replyId: commentId } }
            });
            if (existing) return { success: true, message: "Reply already saved" };

            await prisma.savedComment.create({
                data: { userId, replyId: commentId }
            });
        } else {
            const existing = await prisma.savedComment.findUnique({
                where: { userId_commentId: { userId, commentId } }
            });
            if (existing) return { success: true, message: "Comment already saved" };

            await prisma.savedComment.create({
                data: { userId, commentId }
            });
        }

        return { success: true, message: "Saved successfully" };
    }

    static async removeSavedComment(userId: string, commentId: string) {
        try {
            // Check both possible keys
            const commentSave = await prisma.savedComment.findUnique({
                where: { userId_commentId: { userId, commentId } }
            });

            if (commentSave) {
                await prisma.savedComment.delete({
                    where: { userId_commentId: { userId, commentId } }
                });
            } else {
                await prisma.savedComment.delete({
                    where: { userId_replyId: { userId, replyId: commentId } }
                });
            }
            return { success: true, message: "Removed from saved" };
        } catch (error) {
            return { success: false, message: "Saved item not found" };
        }
    }

    static async getSavedComments(userId: string) {
        const saved = await prisma.savedComment.findMany({
            where: { userId },
            include: {
                comment: {
                    include: {
                        author: { select: { id: true, username: true } },
                        thread: { select: { id: true, title: true, communityId: true } }
                    }
                },
                reply: {
                    include: {
                        author: { select: { id: true, username: true } },
                        comment: {
                            include: {
                                thread: { select: { id: true, title: true, communityId: true } }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return saved.map(item => ({
            ...item,
            type: item.replyId ? 'REPLY' : 'COMMENT'
        }));
    }
}