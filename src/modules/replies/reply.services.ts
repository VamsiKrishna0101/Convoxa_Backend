import prisma from "../../config/prisma.js";
import type { ReplyInput, ReplyOutput, EditReplyInput, DeleteReplyInput } from "./reply.types.js";
import { NotificationService } from "../notification/notification.services.js";
import { NotificationType, NotificationStatus } from "@prisma/client";
import { CacheService } from "../common/cache.service.js";

export class ReplyService {

    // Generate materialized path for new reply using timestamps (no race conditions)
    private static async generatePath(commentId: string, parentId: string | null): Promise<string> {
        // Use timestamp + random suffix for unique, chronologically-ordered paths
        const segment = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

        if (!parentId) {
            // Top-level reply to comment
            return segment;
        }

        // Reply to existing reply - prepend parent's path
        const parent = await prisma.reply.findUnique({ where: { id: parentId } });
        if (!parent) throw new Error("PARENT_REPLY_NOT_FOUND");

        return `${parent.path}.${segment}`;
    }

    // CREATE REPLY (top-level or nested)
    static async createReply(
        input: ReplyInput,
        userId: string
    ): Promise<ReplyOutput> {
        const { commentId, content, parentId, imageUrl, isAnonymous = false } = input;

        // Allow empty content if GIF/image is provided
        if ((!content || content.trim().length === 0) && !imageUrl) {
            throw new Error("CONTENT_REQUIRED");
        }

        if (content && content.length > 10000) {
            throw new Error("Content must be less than 10,000 characters.");
        }

        // Verify comment exists and get thread info
        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            include: { thread: true }
        });
        if (!comment) throw new Error("COMMENT_NOT_FOUND");

        // Fetch community for anonymous validation
        const community = await prisma.community.findUnique({
            where: { id: comment.thread.communityId }
        });
        if (!community) throw new Error("COMMUNITY_NOT_FOUND");

        // Validate anonymous posting
        if (isAnonymous && !community.allowAnonymous) {
            throw new Error("ANONYMOUS_NOT_ALLOWED");
        }

        // Check community membership
        // Membership check removed to allow non-members to reply
        // const membership = await prisma.communityMember.findUnique({ ... });
        // if (!membership) throw new Error("NOT_A_MEMBER");

        // Get user for username
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) throw new Error("USER_NOT_FOUND");

        // Generate path
        const path = await this.generatePath(commentId, parentId || null);
        const depth = path.split('.').length - 1;

        // Create reply
        const reply = await prisma.reply.create({
            data: {
                content,
                commentId,
                authorId: userId,
                username: isAnonymous ? "Anonymous" : user.username,
                parentId: parentId || null,
                path,
                depth,
                upvotes: 0,
                downvotes: 0,
                isAnonymous,
                imageUrl: imageUrl || null,
            }
        });

        // Notify Comment Author (if not self)
        if (comment.authorId !== userId) {
            const truncatedReply = reply.content.length > 50 ? reply.content.substring(0, 50) + "..." : reply.content;

            await NotificationService.createNotification({
                content: `${isAnonymous ? "Anonymous" : user.username} replied: "${truncatedReply}" to your comment`,
                type: NotificationType.REPLY_TO_COMMENT,
                status: NotificationStatus.UNREAD,
                senderId: userId,
                receiverId: comment.authorId,
                commentId: comment.id,
                replyId: reply.id,
                threadId: comment.threadId
            });

            // Send Push Notification
            await NotificationService.sendPushNotification(
                comment.authorId,
                `New Reply to your comment`,
                `${isAnonymous ? "Anonymous" : user.username}: ${truncatedReply}`,
                { type: "REPLY_TO_COMMENT", threadId: comment.threadId, commentId: comment.id, replyId: reply.id },
                reply.imageUrl || undefined
            ).catch(err => {
                // console.error("Reply push failed", err);
            });
        }

        return {
            id: reply.id,
            content: reply.content,
            username: reply.username,
            commentId: reply.commentId,
            authorId: isAnonymous ? "" : reply.authorId,
            parentId: reply.parentId,
            path: reply.path,
            depth: reply.depth,
            isAnonymous: (reply as any).isAnonymous ?? false,
            isDeleted: reply.isDeleted,
            deletedAt: reply.deletedAt?.toISOString() || null,
            createdAt: reply.createdAt.toISOString(),
            updatedAt: reply.updatedAt.toISOString(),
            upvotes: 0,
            downvotes: 0,
            netVotes: 0,
            userVote: null,
            hasVoted: null,
            imageUrl: reply.imageUrl,
            avatarConfig: isAnonymous ? null : user.avatarConfig,
            children: []
        };
    }

    // GET ALL REPLIES FOR COMMENT
    static async getCommentReplies(
        commentId: string,
        userId?: string,
        cursor?: string,
        limit: number = 20
    ): Promise<{ replies: ReplyOutput[], nextCursor: string | null }> {
        const comment = await prisma.comment.findUnique({
            where: { id: commentId }
        });
        if (!comment) throw new Error("COMMENT_NOT_FOUND");

        const replies = await prisma.reply.findMany({
            where: { commentId },
            take: limit + 1,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            include: {
                author: { select: { avatarConfig: true } },
                votes: {
                    select: { userId: true, type: true }
                }
            },
            orderBy: { createdAt: 'asc' } // Changed from path to createdAt for consistent cursor behavior in flat list
        });

        // Note: 'path' ordering is better for nested structure, but cursor pagination on 'path' string is tricky.
        // For now, we fetch linear and let frontend reconstruct or just show linear.
        // Actually, Reddit uses linear 'load more' for deep threads.
        // Let's stick to createdAt for simplicity of cursor 
        // OR better: use ID cursor but still order by createdAt.

        let nextCursor: string | null = null;
        if (replies.length > limit) {
            const nextItem = replies.pop();
            nextCursor = nextItem!.id;
        }

        const getUserVote = (votes: any[], userId?: string) => {
            if (!userId) return null;
            const vote = votes.find(v => v.userId === userId);
            return vote ? vote.type : null;
        };

        const enrichedReplies = replies.map(reply => {
            const anon = (reply as any).isAnonymous ?? false;
            return {
                id: reply.id,
                content: reply.content,
                username: reply.username,
                commentId: reply.commentId,
                authorId: anon ? "" : reply.authorId,
                parentId: reply.parentId,
                path: reply.path,
                depth: reply.depth,
                isAnonymous: anon,
                isDeleted: reply.isDeleted,
                deletedAt: reply.deletedAt?.toISOString() || null,
                createdAt: reply.createdAt.toISOString(),
                updatedAt: reply.updatedAt.toISOString(),
                upvotes: reply.upvotes,
                downvotes: reply.downvotes,
                netVotes: reply.upvotes - reply.downvotes,
                userVote: getUserVote(reply.votes, userId),
                hasVoted: getUserVote(reply.votes, userId),
                imageUrl: reply.imageUrl,
                avatarConfig: anon ? null : reply.author.avatarConfig,
                children: []
            };
        });

        return {
            replies: enrichedReplies,
            nextCursor
        };
    }

    // EDIT REPLY
    static async editReply(
        input: EditReplyInput,
        userId: string
    ): Promise<ReplyOutput> {
        const { replyId, content } = input;

        if (!content || content.trim().length === 0) {
            throw new Error("CONTENT_REQUIRED");
        }

        if (content.length > 10000) {
            throw new Error("Content must be less than 10,000 characters.");
        }

        const reply = await prisma.reply.findUnique({
            where: { id: replyId }
        });

        if (!reply) throw new Error("REPLY_NOT_FOUND");
        if (reply.authorId !== userId) throw new Error("NOT_AUTHORIZED");
        if (reply.isDeleted) throw new Error("REPLY_DELETED");

        const updated = await prisma.reply.update({
            where: { id: replyId },
            data: { content }
        });

        const userVote = await prisma.replyVote.findUnique({
            where: { replyId_userId: { replyId: updated.id, userId } }
        });

        return {
            id: updated.id,
            content: updated.content,
            username: updated.username,
            commentId: updated.commentId,
            authorId: (updated as any).isAnonymous ? "" : updated.authorId,
            parentId: updated.parentId,
            path: updated.path,
            depth: updated.depth,
            isAnonymous: (updated as any).isAnonymous ?? false,
            isDeleted: updated.isDeleted,
            deletedAt: updated.deletedAt?.toISOString() || null,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            upvotes: updated.upvotes,
            downvotes: updated.downvotes,
            netVotes: updated.upvotes - updated.downvotes,
            userVote: userVote ? userVote.type : null,
            hasVoted: userVote ? userVote.type : null,
            children: []
        };
    }

    // DELETE REPLY
    static async deleteReply(
        input: DeleteReplyInput,
        userId: string
    ) {
        const { replyId } = input;

        const reply = await prisma.reply.findUnique({
            where: { id: replyId },
            include: {
                comment: {
                    include: {
                        thread: {
                            include: {
                                community: true
                            }
                        }
                    }
                }
            }
        });

        if (!reply) throw new Error("REPLY_NOT_FOUND");

        // Authorization check: Author, Community Owner, ADMIN, or MODERATOR
        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: {
                    userId,
                    communityId: reply.comment.thread.communityId
                }
            }
        });

        const isAuthor = reply.authorId === userId;
        const isCommOwner = reply.comment.thread.community.ownerId === userId;
        const isAdmin = membership?.role === "ADMIN";
        const isModerator = membership?.role === "MODERATOR";

        if (!isAuthor && !isCommOwner && !isAdmin && !isModerator) {
            throw new Error("NOT_AUTHORIZED");
        }

        await prisma.reply.update({
            where: { id: replyId },
            data: {
                content: "[deleted]",
                username: "deleted",
                imageUrl: null,
                isDeleted: true,
                deletedAt: new Date()
            }
        });
        return { success: true };
    }

    // VOTE REPLY
    static async voteReply(
        replyId: string,
        userId: string,
        type: "UP" | "DOWN"
    ) {
        const existingVote = await prisma.replyVote.findUnique({
            where: { replyId_userId: { replyId, userId } }
        });

        if (existingVote) {
            if (existingVote.type === type) {
                // Remove vote (toggle)
                await prisma.$transaction([
                    prisma.replyVote.delete({ where: { id: existingVote.id } }),
                    prisma.reply.update({
                        where: { id: replyId },
                        data: type === "UP" ? { upvotes: { decrement: 1 }, netVotes: { decrement: 1 } } : { downvotes: { decrement: 1 }, netVotes: { increment: 1 } }
                    })
                ]);
                return { success: true, action: "removed" };
            } else {
                // Switch vote
                await prisma.$transaction([
                    prisma.replyVote.update({ where: { id: existingVote.id }, data: { type } }),
                    prisma.reply.update({
                        where: { id: replyId },
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
                prisma.replyVote.create({ data: { replyId, userId, type } }),
                prisma.reply.update({
                    where: { id: replyId },
                    data: type === "UP" ? { upvotes: { increment: 1 }, netVotes: { increment: 1 } } : { downvotes: { increment: 1 }, netVotes: { decrement: 1 } }
                })
            ]);

            // Notify Author on Upvote (only if not self-vote)
            if (type === "UP") {
                try {
                    // Fetch reply author and thread context
                    const reply = await prisma.reply.findUnique({
                        where: { id: replyId },
                        include: { comment: { select: { threadId: true } } }
                    });

                    // Fetch voter username
                    const voter = await prisma.user.findUnique({
                        where: { id: userId },
                        select: { username: true }
                    });

                    if (reply && reply.authorId !== userId && voter) {
                        await NotificationService.createNotification({
                            content: `${voter.username} upvoted your reply`,
                            type: NotificationType.UPVOTED_REPLY,
                            status: NotificationStatus.UNREAD,
                            receiverId: reply.authorId,
                            senderId: userId,
                            replyId: replyId,
                            commentId: reply.commentId,
                            threadId: reply.comment.threadId
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
        replyId: string,
        userId: string
    ) {
        const vote = await prisma.replyVote.findUnique({
            where: { replyId_userId: { replyId, userId } }
        });

        if (!vote) throw new Error("VOTE_NOT_FOUND");

        await prisma.$transaction([
            prisma.replyVote.delete({ where: { id: vote.id } }),
            prisma.reply.update({
                where: { id: replyId },
                data: vote.type === "UP" ? { upvotes: { decrement: 1 }, netVotes: { decrement: 1 } } : { downvotes: { decrement: 1 }, netVotes: { increment: 1 } }
            })
        ]);

        return { success: true };
    }

    // GET USER REPLY VOTES
    static async getUserReplyVotes(userId: string) {
        const votes = await prisma.replyVote.findMany({
            where: { userId }
        });
        return { success: true, result: votes };
    }
}
