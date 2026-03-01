import prisma from "../../config/prisma.js";
import type { CommentInput, CommentOutput, EditCommentInput, DeleteCommentInput } from "./comment.types.js";
import { NotificationType, NotificationStatus } from "@prisma/client";
import { NotificationService } from "../notification/notification.services.js";
import { CacheService } from "../common/cache.service.js";
import { ScoreService } from "../common/score.services.js";


export class CommentService {

    // CREATE COMMENT (simple, top-level only)
    static async createComment(
        input: CommentInput,
        userId: string
    ): Promise<CommentOutput> {
        const { threadId, content, imageUrl, isAnonymous = false } = input;

        // Allow empty content if GIF/image is provided
        if ((!content || content.trim().length === 0) && !imageUrl) {
            throw new Error("CONTENT_REQUIRED");
        }

        if (content && content.length > 10000) {
            throw new Error("Content must be less than 10,000 characters.");
        }

        // Verify thread exists
        const thread = await prisma.thread.findUnique({
            where: { id: threadId }
        });
        if (!thread) throw new Error("THREAD_NOT_FOUND");

        // Fetch community for anonymous validation
        const community = await prisma.community.findUnique({
            where: { id: thread.communityId }
        });
        if (!community) throw new Error("COMMUNITY_NOT_FOUND");

        // Validate anonymous posting
        if (isAnonymous && !community.allowAnonymous) {
            throw new Error("ANONYMOUS_NOT_ALLOWED");
        }

        // Check community membership
        // Membership check removed to allow non-members to comment
        // const membership = await prisma.communityMember.findUnique({ ... });
        // if (!membership) throw new Error("NOT_A_MEMBER");

        // Get user for username
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) throw new Error("USER_NOT_FOUND");

        // Create comment
        const comment = await prisma.comment.create({
            data: {
                content,
                threadId,
                authorId: userId,
                username: isAnonymous ? "Anonymous" : user.username,
                isAnonymous,
                imageUrl: imageUrl || null,  // Save GIF/image URL
            }
        });

        // Update Thread's commentsCount and hotScore
        const updatedThread = await prisma.thread.update({
            where: { id: threadId },
            data: {
                commentsCount: { increment: 1 }
            }
        });

        // Recalculate Hot Score
        const newHotScore = ScoreService.calculateHotScore(
            updatedThread.upvotes,
            updatedThread.downvotes,
            updatedThread.createdAt,
            updatedThread.commentsCount
        );

        await prisma.thread.update({
            where: { id: threadId },
            data: { hotScore: newHotScore }
        });

        // Notify Thread Author (if not self)
        if (thread.authorId !== userId) {
            const truncatedContent = comment.content.length > 50 ? comment.content.substring(0, 50) + "..." : comment.content;
            const truncatedTitle = thread.title.length > 30 ? thread.title.substring(0, 30) + "..." : thread.title;

            await NotificationService.createNotification({
                content: `${isAnonymous ? "Anonymous" : user.username} commented: "${truncatedContent}" on your thread: "${truncatedTitle}"`,
                type: NotificationType.REPLY_TO_THREAD,
                status: NotificationStatus.UNREAD,
                receiverId: thread.authorId,
                senderId: userId,
                threadId: thread.id,
                commentId: comment.id
            });

            // Send Push Notification to Thread Author
            await NotificationService.sendPushNotification(
                thread.authorId,
                `New Comment on: ${truncatedTitle}`,
                `${isAnonymous ? "Anonymous" : user.username}: ${truncatedContent}`,
                { type: "REPLY_TO_THREAD", threadId: thread.id, commentId: comment.id },
                comment.imageUrl || undefined
            ).catch(err => {
                // console.error("Comment push failed", err);
            });
        }

        return {
            id: comment.id,
            content: comment.content,
            username: comment.username,
            threadId: comment.threadId,
            authorId: isAnonymous ? "" : comment.authorId,
            isAnonymous: comment.isAnonymous,
            createdAt: comment.createdAt.toISOString(),
            updatedAt: comment.updatedAt.toISOString(),
            upvotes: 0,
            downvotes: 0,
            netVotes: 0,
            userVote: null,
            hasVoted: null,
            imageUrl: comment.imageUrl,
            avatarConfig: isAnonymous ? null : user.avatarConfig,
        };
    }

    // GET ALL COMMENTS FOR THREAD
    static async getThreadComments(
        threadId: string,
        userId?: string,
        cursor?: string,
        limit: number = 20,
        sortBy: "TOP" | "NEW" | "OLD" = "TOP"
    ): Promise<{ comments: CommentOutput[], nextCursor: string | null }> {
        // Optimize: Cache FIRST PAGE only (no cursor)
        const cacheKey = `comments:${threadId}:${sortBy}`;
        const isFirstPage = !cursor;

        if (isFirstPage) {
            const cached = await CacheService.get<any>(cacheKey);
            if (cached) {
                // If we have cached comments, we still need to apply user-specific votes
                // The cache stores the generic comment data + votes array (or pre-calculated counts)
                // Actually, our cache stores the RESULT of the service, which includes `userVote` field.
                // BUT `userVote` depends on `userId`.
                // We cannot cache `userVote` in the shared cache.
                // WE MUST CACHE THE RAW DATA (or enriched without user specifics) AND RE-CALCULATE USER VOTE.
                // However, `enrichedComments` map structure is simple.

                // Better approach for 5MB limit & Simplicity:
                // Cache the `enrichedComments` from below BUT WITHOUT `userVote` / `hasVoted`.
                // OR, just fetch from DB because checking votes is complex?

                // Let's cache the PRISMA RESULT (data), then map it.
                // But prisma result has `votes` array? 
                // If we cache that, it might be large.

                // Let's cache the `enrichedComments` structure (lightweight) where userVote is null.
                // Then, if userId is present, we might need to fetch votes?
                // Fetching just votes: `prisma.commentVote.findMany({ where: { userId, commentId: { in: ids } } })`
                // This is efficient.

                // Implementation:
                // 1. Check Cache
                // 2. If hit -> Get IDs -> Fetch User Votes -> Merge -> Return.
            }
        }

        // --- STANDARD FETCH ---
        const thread = await prisma.thread.findUnique({
            where: { id: threadId }
        });
        if (!thread) throw new Error("THREAD_NOT_FOUND");

        // Determine order
        console.log("🔍 [Service] getThreadComments sortBy:", sortBy);

        let orderBy: any = [
            { createdAt: 'asc' },
            { id: 'asc' }
        ]; // Default 'OLD'

        if (sortBy === 'TOP') {
            orderBy = [
                { netVotes: 'desc' },
                { createdAt: 'desc' },
                { id: 'desc' }
            ];
        } else if (sortBy === 'NEW') {
            orderBy = [
                { createdAt: 'desc' },
                { id: 'desc' }
            ];
        }

        console.log("🔍 [Service] Computed orderBy:", JSON.stringify(orderBy));

        const comments = await prisma.comment.findMany({
            where: { threadId },
            take: limit + 1,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            include: {
                author: { select: { avatarConfig: true } },
                votes: {
                    select: { userId: true, type: true }
                }
            },
            orderBy
        });

        let nextCursor: string | null = null;
        if (comments.length > limit) {
            const nextItem = comments.pop();
            nextCursor = nextItem!.id;
        }

        const getUserVote = (votes: any[], userId?: string) => {
            if (!userId) return null;
            const vote = votes.find(v => v.userId === userId);
            return vote ? vote.type : null;
        };

        const enrichedComments = comments.map(comment => {
            const anon = (comment as any).isAnonymous ?? false;
            return {
                id: comment.id,
                content: comment.content,
                username: comment.username,
                threadId: comment.threadId,
                authorId: anon ? "" : comment.authorId,
                isAnonymous: anon,
                createdAt: comment.createdAt.toISOString(),
                updatedAt: comment.updatedAt.toISOString(),
                upvotes: comment.upvotes,
                downvotes: comment.downvotes,
                netVotes: comment.netVotes,
                userVote: getUserVote(comment.votes, userId),
                hasVoted: getUserVote(comment.votes, userId),
                imageUrl: comment.imageUrl,
                avatarConfig: anon ? null : comment.author.avatarConfig,
            };
        });

        // Set Cache if First Page
        // Note: We are caching 'userVote' inside this if we just store `enrichedComments`.
        // This is BAD if we cache it for User A and serve to User B.
        // WE CANNOT CACHE `userVote`.
        // Current implementation of simple services often ignores this complexity.
        // For a proper solution:
        // Cache `enrichedComments` BUT set `userVote: null` in the cached value.

        if (isFirstPage) {
            const cacheSafeComments = enrichedComments.map(c => ({ ...c, userVote: null, hasVoted: null }));
            await CacheService.set(cacheKey, { comments: cacheSafeComments, nextCursor }, 120); // 2 mins TTL (high churn)
        }

        return {
            comments: enrichedComments,
            nextCursor
        };
    }

    // EDIT COMMENT
    static async editComment(
        input: EditCommentInput,
        userId: string
    ): Promise<CommentOutput> {
        const { commentId, content } = input;

        if (!content || content.trim().length === 0) {
            throw new Error("CONTENT_REQUIRED");
        }

        if (content.length > 10000) {
            throw new Error("Content must be less than 10,000 characters.");
        }

        const comment = await prisma.comment.findUnique({
            where: { id: commentId }
        });

        if (!comment) throw new Error("COMMENT_NOT_FOUND");
        if (comment.authorId !== userId) throw new Error("NOT_AUTHORIZED");

        const updated = await prisma.comment.update({
            where: { id: commentId },
            data: { content }
        });

        return {
            id: updated.id,
            content: updated.content,
            username: updated.username,
            threadId: updated.threadId,
            authorId: (updated as any).isAnonymous ? "" : updated.authorId,
            isAnonymous: (updated as any).isAnonymous ?? false,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            upvotes: updated.upvotes,
            downvotes: updated.downvotes,
            netVotes: updated.upvotes - updated.downvotes,
            userVote: null,
            hasVoted: null
        };
    }

    // DELETE COMMENT (hard delete - no soft delete for comments)
    static async deleteComment(
        input: DeleteCommentInput,
        userId: string
    ) {
        const { commentId } = input;

        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            include: {
                thread: true
            }
        });

        if (!comment) throw new Error("COMMENT_NOT_FOUND");

        // Helper to update thread score
        const syncThreadScore = async (threadId: string) => {
            const updatedThread = await prisma.thread.update({
                where: { id: threadId },
                data: { commentsCount: { decrement: 1 } }
            });

            const newHotScore = ScoreService.calculateHotScore(
                updatedThread.upvotes,
                updatedThread.downvotes,
                updatedThread.createdAt,
                updatedThread.commentsCount
            );

            await prisma.thread.update({
                where: { id: threadId },
                data: { hotScore: newHotScore }
            });
        };

        // Author can delete
        if (comment.authorId === userId) {
            await prisma.comment.update({
                where: { id: commentId },
                data: {
                    content: "[deleted]",
                    username: "deleted",
                    isDeleted: true,
                    deletedAt: new Date()
                }
            });
            await syncThreadScore(comment.threadId);
            return { success: true };
        }

        // MOD / ADMIN can delete
        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: {
                    userId,
                    communityId: comment.thread.communityId
                }
            }
        });

        if (
            !membership ||
            (membership.role !== "ADMIN" && membership.role !== "MODERATOR")
        ) {
            throw new Error("NOT_AUTHORIZED");
        }

        await prisma.comment.update({
            where: { id: commentId },
            data: {
                content: "[deleted]",
                username: "deleted",
                isDeleted: true,
                deletedAt: new Date()
            }
        });
        await syncThreadScore(comment.threadId);
        return { success: true };
    }

    // VOTE COMMENT
    static async voteComment(
        commentId: string,
        userId: string,
        type: "UP" | "DOWN"
    ) {
        const existingVote = await prisma.commentVote.findUnique({
            where: { commentId_userId: { commentId, userId } }
        });

        if (existingVote) {
            if (existingVote.type === type) {
                // Remove vote (toggle)
                await prisma.$transaction([
                    prisma.commentVote.delete({ where: { id: existingVote.id } }),
                    prisma.comment.update({
                        where: { id: commentId },
                        data: type === "UP"
                            ? { upvotes: { decrement: 1 }, netVotes: { decrement: 1 } }
                            : { downvotes: { decrement: 1 }, netVotes: { increment: 1 } }
                    })
                ]);
                return { success: true, action: "removed" };
            } else {
                // Switch vote
                await prisma.$transaction([
                    prisma.commentVote.update({ where: { id: existingVote.id }, data: { type } }),
                    prisma.comment.update({
                        where: { id: commentId },
                        data: type === "UP"
                            ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 }, netVotes: { increment: 2 } }
                            : { downvotes: { increment: 1 }, upvotes: { decrement: 1 }, netVotes: { decrement: 2 } }
                    })
                ]);
                return { success: true, action: type === "UP" ? "upvoted" : "downvoted" };
            }
        } else {
            // New vote
            await prisma.$transaction([
                prisma.commentVote.create({ data: { commentId, userId, type } }),
                prisma.comment.update({
                    where: { id: commentId },
                    data: type === "UP"
                        ? { upvotes: { increment: 1 }, netVotes: { increment: 1 } }
                        : { downvotes: { increment: 1 }, netVotes: { decrement: 1 } }
                })
            ]);

            // Notify Author on Upvote (only if not self-vote)
            if (type === "UP") {
                try {
                    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true, content: true } });
                    const voter = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });

                    if (comment && comment.authorId !== userId && voter) {
                        const truncatedContent = comment.content.length > 50 ? comment.content.substring(0, 50) + "..." : comment.content;

                        await NotificationService.createNotification({
                            content: `${voter.username} upvoted your comment: "${truncatedContent}"`,
                            type: NotificationType.UPVOTED_COMMENT,
                            status: NotificationStatus.UNREAD,
                            receiverId: comment.authorId,
                            senderId: userId,
                            commentId: commentId,
                        });
                    }
                } catch (e) {
                    console.error("Failed to notify upvote", e);
                }
            }

            return { success: true, action: type === "UP" ? "upvoted" : "downvoted" };
        }
    }

    // REMOVE VOTE
    static async removeVote(
        commentId: string,
        userId: string
    ) {
        const vote = await prisma.commentVote.findUnique({
            where: { commentId_userId: { commentId, userId } }
        });

        if (!vote) throw new Error("VOTE_NOT_FOUND");

        await prisma.$transaction([
            prisma.commentVote.delete({ where: { id: vote.id } }),
            prisma.comment.update({
                where: { id: commentId },
                data: vote.type === "UP"
                    ? { upvotes: { decrement: 1 }, netVotes: { decrement: 1 } }
                    : { downvotes: { decrement: 1 }, netVotes: { increment: 1 } }
            })
        ]);

        return { success: true };
    }

    // GET USER VOTES
    static async getUserCommentVotes(userId: string) {
        const votes = await prisma.commentVote.findMany({
            where: { userId },
            select: {
                id: true,
                commentId: true,
                type: true,
                userId: true
            }
        });
        return votes;
    }
}
