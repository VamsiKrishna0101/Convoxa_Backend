import { ThreadInput, ThreadOutput, VoteInput } from "./thread.types.js";
import prisma from "../../config/prisma.js";
import { NotificationType, NotificationStatus } from "@prisma/client";
import { NotificationService } from "../notification/notification.services.js";
import { ScoreService } from "../common/score.services.js";
import { CacheService, CACHE_TTL } from "../common/cache.service.js";
import { redis } from "../../config/redis.js";
import { BotService } from "../bot/bot.service.js";


export class ThreadService {

    // Helper to calculate votes for a thread
    // OPTIMIZED: Uses DB counts instead of scanning all votes
    private static async getThreadVoteStatus(thread: any, userId?: string) {

        // Trust the DB counters (maintained via voteThread)
        const upvotes = thread.upvotes || 0;
        const downvotes = thread.downvotes || 0;
        const netVotes = upvotes - downvotes;

        let userVote: "UP" | "DOWN" | null = null;
        if (userId) {
            const vote = await prisma.threadVote.findUnique({
                where: {
                    threadId_userId: {
                        threadId: thread.id,
                        userId
                    }
                }
            });
            userVote = vote ? vote.type : null;
        }

        return { upvotes, downvotes, netVotes, userVote };
    }

    private static async getThreadSaveStatus(threadId: string, userId?: string): Promise<boolean> {
        if (!userId) return false;
        const saved = await prisma.savedThread.findUnique({
            where: {
                userId_threadId: {
                    userId,
                    threadId
                }
            }
        });
        return !!saved;
    }

    static async createThread(
        input: ThreadInput,
        userId: string
    ): Promise<ThreadOutput> {
        const { title, content, communityId, imageUrl, isAnonymous = false } = input;

        if (!title || !content || !communityId) {
            throw new Error("TITLE_CONTENT_COMMUNITY_REQUIRED");
        }

        if (title.length > 300) {
            throw new Error("Title must be less than 300 characters.");
        }

        if (content.length > 10000) {
            throw new Error("Content must be less than 10,000 characters.");
        }

        // 1️⃣ Ensure user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) throw new Error("USER_NOT_FOUND");

        // 2️⃣ Ensure community exists
        const community = await prisma.community.findUnique({
            where: { id: communityId }
        });
        if (!community) throw new Error("COMMUNITY_NOT_FOUND");

        // 3️⃣ Ensure user is a member
        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: {
                    userId,
                    communityId
                }
            }
        });
        if (!membership) throw new Error("NOT_A_MEMBER");

        // 4️⃣ Validate anonymous posting
        if (isAnonymous && !community.allowAnonymous) {
            throw new Error("ANONYMOUS_NOT_ALLOWED");
        }

        // 5️⃣ Create thread with optional imageUrl
        const thread = await prisma.thread.create({
            data: {
                title,
                content,
                communityId,
                authorId: userId,
                username: isAnonymous ? "Anonymous" : user.username,
                communityName: community.name,
                imageUrl: imageUrl || null,
                isFlagged: input.isFlagged || false,
                isAnonymous,
                hotScore: ScoreService.calculateHotScore(0, 0, new Date()) // Initial score
            }
        });

        // Invalidate Community Cache (Thread count changed)
        await CacheService.del(CacheService.keys.community(communityId));

        // --- PUSH NOTIFICATIONS FOR COMMUNITY MEMBERS (Push-Only) ---
        try {
            const membersToNotify = await prisma.communityMember.findMany({
                where: {
                    communityId,
                    isMuted: false,
                    userId: { not: userId }
                },
                select: { userId: true }
            });

            await Promise.all(membersToNotify.map(async (member) => {
                // Check Redis for 2-minute throttle (reduced from 2 hours)
                const throttleKey = `push_limit:thread:${communityId}:${member.userId}`;
                const isThrottled = await redis.get(throttleKey);

                if (!isThrottled) {
                    // Send Push Directly (No DB Record)
                    const notificationImageUrl = thread.imageUrl || undefined; // Thread image takes precedence, NO fallback to community image per USER_REQUEST

                    const title = `c/${community.name}`;
                    const body = `${isAnonymous ? "Anonymous user" : user.username} posted: ${thread.title}`;

                    await NotificationService.sendPushNotification(
                        member.userId,
                        title,
                        body,
                        { type: "NEW_THREAD", threadId: thread.id, communityId },
                        notificationImageUrl
                    ).catch(err => {
                        // console.error("Push failed for community member", member.userId, err);
                    });

                    // Set throttle in Redis for 2 minutes (120 seconds)
                    await redis.set(throttleKey, "1", "EX", 120);
                }
            }));
        } catch (err) {
            console.error("Failed to send community notifications:", err);
        }
        // Also invalidate Trending Feed since a new post exists? 
        // We can't easily invalidate "trending" broadly, but it will expire in 2 mins.

        // 🤖 CONVOXA BOT TRIGGER (Comments Only)
        try {
            await BotService.scheduleThreadComment(thread.id);
        } catch (e) {
            console.error("Failed to schedule bot comment", e);
        }

        return {
            id: thread.id,
            title: thread.title,
            content: thread.content,
            imageUrl: thread.imageUrl || undefined,
            upvotes: 0,
            downvotes: 0,
            netVotes: 0,
            hasVoted: null,
            isSaved: false, // New threads aren't saved yet
            commentsCount: 0,  // New thread has no comments
            username: thread.username,
            communityName: thread.communityName,
            communityId: thread.communityId,
            communityImageUrl: community.imageUrl,
            authorId: thread.isAnonymous ? "" : thread.authorId,
            isAnonymous: thread.isAnonymous,
            isOwner: true, // Creator is owner
            allowAnonymous: community.allowAnonymous,
            avatarConfig: thread.isAnonymous ? null : user.avatarConfig,
            createdAt: thread.createdAt.toISOString(),
            updatedAt: thread.updatedAt.toISOString()
        };
    }

    static async getThreadById(threadId: string, userId?: string): Promise<ThreadOutput> {
        const cacheKey = CacheService.keys.thread(threadId);

        // 1. Try Cache for Thread Data (Generic)
        let thread: any = await CacheService.get(cacheKey);

        if (!thread) {
            thread = await prisma.thread.findUnique({
                where: { id: threadId },
                include: {
                    community: true,
                    author: { select: { id: true, username: true, avatarConfig: true } },
                    _count: { select: { comments: true } }
                }
            });

            if (!thread) throw new Error("THREAD_NOT_FOUND");

            // Cache the GENERIC thread data (without user vote)
            await CacheService.set(cacheKey, thread, CACHE_TTL.THREAD_DETAILS);
        }

        // 2. Fetch User Specifics (Vote) - Always fresh or handled separately
        // We don't cache userVote inside the thread object
        const voteData = await this.getThreadVoteStatus(thread, userId);
        const isSaved = await this.getThreadSaveStatus(thread.id, userId);

        return {
            id: thread.id,
            title: thread.title,
            content: thread.content,
            imageUrl: thread.imageUrl || undefined,
            upvotes: voteData.upvotes,
            downvotes: voteData.downvotes,
            netVotes: voteData.netVotes,
            hasVoted: voteData.userVote,
            isSaved,
            commentsCount: thread._count ? thread._count.comments : (thread.commentsCount || 0),
            username: thread.username,
            communityName: thread.communityName,
            communityId: thread.communityId,
            communityImageUrl: thread.community?.imageUrl || thread.communityImageUrl,
            authorId: (thread.isAnonymous && thread.authorId !== userId) ? "" : thread.authorId,
            isAnonymous: thread.isAnonymous ?? false,
            isOwner: thread.authorId === userId,
            allowAnonymous: thread.community?.allowAnonymous ?? false,
            avatarConfig: thread.isAnonymous ? null : (thread.author?.avatarConfig || thread.avatarConfig),
            createdAt: typeof thread.createdAt === 'string' ? thread.createdAt : thread.createdAt.toISOString(),
            updatedAt: typeof thread.updatedAt === 'string' ? thread.updatedAt : thread.updatedAt.toISOString()
        };
    }

    static async getAllThreadsOfCommunity(
        communityId: string,
        userId?: string,
        cursor?: string,
        limit: number = 20,
        search?: string,
        sortBy: "new" | "old" | "top" | "controversial" = "new"
    ): Promise<{ data: ThreadOutput[], nextCursor: string | null }> {
        const community = await prisma.community.findUnique({
            where: { id: communityId }
        });

        if (!community) throw new Error("COMMUNITY_NOT_FOUND");

        const whereClause: any = { communityId, isDeleted: false };
        if (search) {
            whereClause.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } }
            ];
        }

        let orderBy: any = { createdAt: "desc" };
        if (sortBy === "old") orderBy = { createdAt: "asc" };
        if (sortBy === "top") orderBy = { upvotes: "desc" };
        if (sortBy === "controversial") orderBy = { downvotes: "desc" };

        const threads = await prisma.thread.findMany({
            where: whereClause,
            take: limit + 1,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            include: {
                author: { select: { id: true, username: true, avatarConfig: true } },
                _count: { select: { comments: true } }
            },
            orderBy
        });

        let nextCursor: string | null = null;
        if (threads.length > limit) {
            const nextItem = threads.pop();
            nextCursor = nextItem!.id;
        }

        // Calculate votes for each thread
        const threadsWithVotes = await Promise.all(
            threads.map(async (thread) => {
                const voteData = await this.getThreadVoteStatus(thread, userId);
                const isSaved = await this.getThreadSaveStatus(thread.id, userId);
                return {
                    id: thread.id,
                    title: thread.title,
                    content: thread.content,
                    imageUrl: thread.imageUrl || undefined,
                    upvotes: voteData.upvotes,
                    downvotes: voteData.downvotes,
                    netVotes: voteData.netVotes,
                    hasVoted: voteData.userVote,
                    isSaved,
                    commentsCount: thread._count.comments,
                    username: thread.username,
                    communityName: thread.communityName,
                    communityId: thread.communityId,
                    communityImageUrl: community.imageUrl,
                    authorId: (thread.isAnonymous && thread.authorId !== userId) ? "" : thread.authorId,
                    isAnonymous: thread.isAnonymous ?? false,
                    isOwner: thread.authorId === userId,
                    allowAnonymous: community.allowAnonymous,
                    avatarConfig: thread.isAnonymous ? null : thread.author.avatarConfig,
                    createdAt: thread.createdAt.toISOString(),
                    updatedAt: thread.updatedAt.toISOString()
                };
            })
        );

        return {
            data: threadsWithVotes,
            nextCursor
        };
    }

    static async getAllThreadsOfUser(
        userId: string,
        requesterId?: string,
        cursor?: string,
        limit: number = 20
    ): Promise<{ data: ThreadOutput[], nextCursor: string | null }> {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) throw new Error("USER_NOT_FOUND");

        const threads = await prisma.thread.findMany({
            where: { authorId: userId, isDeleted: false },
            take: limit + 1,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            include: {
                author: { select: { id: true, username: true, avatarConfig: true } },
                community: true,
                _count: { select: { comments: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        let nextCursor: string | null = null;
        if (threads.length > limit) {
            const nextItem = threads.pop();
            nextCursor = nextItem!.id;
        }

        const threadsWithVotes = await Promise.all(
            threads.map(async (thread) => {
                const voteData = await this.getThreadVoteStatus(thread, requesterId);
                const isSaved = await this.getThreadSaveStatus(thread.id, requesterId);
                return {
                    id: thread.id,
                    title: thread.title,
                    content: thread.content,
                    imageUrl: thread.imageUrl || undefined,
                    upvotes: voteData.upvotes,
                    downvotes: voteData.downvotes,
                    netVotes: voteData.netVotes,
                    hasVoted: voteData.userVote,
                    isSaved,
                    commentsCount: thread._count.comments,
                    username: thread.username,
                    communityName: thread.communityName,
                    communityId: thread.communityId,
                    communityImageUrl: thread.community.imageUrl,
                    authorId: (thread.isAnonymous && thread.authorId !== requesterId) ? "" : thread.authorId,
                    isAnonymous: thread.isAnonymous ?? false,
                    isOwner: thread.authorId === requesterId,
                    allowAnonymous: thread.community.allowAnonymous,
                    avatarConfig: thread.isAnonymous ? null : thread.author.avatarConfig,
                    createdAt: thread.createdAt.toISOString(),
                    updatedAt: thread.updatedAt.toISOString()
                };
            })
        );

        return {
            data: threadsWithVotes,
            nextCursor
        };
    }

    static async updateThread(
        threadId: string,
        input: Pick<ThreadInput, "title" | "content">,
        userId: string
    ): Promise<ThreadOutput> {
        const thread = await prisma.thread.findUnique({
            where: { id: threadId },
            include: { community: true }
        });

        if (!thread) throw new Error("THREAD_NOT_FOUND");
        if (thread.authorId !== userId) throw new Error("NOT_AUTHORIZED");

        const updateData: any = {};
        if (input.title) {
            if (input.title.length > 300) throw new Error("Title must be less than 300 characters.");
            updateData.title = input.title;
        }
        if (input.content) {
            if (input.content.length > 10000) throw new Error("Content must be less than 10,000 characters.");
            updateData.content = input.content;
        }

        const updated = await prisma.thread.update({
            where: { id: threadId },
            data: updateData,
            include: {
                author: { select: { id: true, username: true, avatarConfig: true } },
                community: true,
                _count: { select: { comments: true } }
            }
        });

        // Invalidate Cache
        await CacheService.del(CacheService.keys.thread(threadId));

        const voteData = await this.getThreadVoteStatus(updated, userId);
        const isSaved = await this.getThreadSaveStatus(updated.id, userId);

        return {
            id: updated.id,
            title: updated.title,
            content: updated.content,
            imageUrl: updated.imageUrl || undefined,
            upvotes: voteData.upvotes,
            downvotes: voteData.downvotes,
            netVotes: voteData.netVotes,
            hasVoted: voteData.userVote,
            isSaved,
            commentsCount: updated._count.comments,
            username: updated.username,
            communityName: updated.communityName,
            communityId: updated.communityId,
            communityImageUrl: updated.community.imageUrl,
            authorId: (updated.isAnonymous && updated.authorId !== userId) ? "" : updated.authorId,
            isAnonymous: updated.isAnonymous ?? false,
            allowAnonymous: updated.community.allowAnonymous,
            avatarConfig: (updated.isAnonymous && updated.authorId !== userId) ? null : updated.author.avatarConfig,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            isOwner: updated.authorId === userId
        };
    }

    static async deleteThread(
        threadId: string,
        userId: string
    ) {
        const thread = await prisma.thread.findUnique({
            where: { id: threadId },
            include: { community: true }
        });

        if (!thread) throw new Error("THREAD_NOT_FOUND");

        // Authorization check: Author, Community Owner, ADMIN, or MODERATOR
        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: {
                    userId,
                    communityId: thread.communityId
                }
            }
        });

        const isAuthor = thread.authorId === userId;
        const isOwner = thread.community.ownerId === userId;
        const isAdmin = membership?.role === "ADMIN";
        const isModerator = membership?.role === "MODERATOR";

        if (!isAuthor && !isOwner && !isAdmin && !isModerator) {
            throw new Error("NOT_AUTHORIZED");
        }

        const updated = await prisma.thread.update({
            where: {
                id: threadId
            },
            data: {
                content: "[deleted]",
                title: "[deleted]",
                username: "deleted",
                imageUrl: null,
                isDeleted: true,
                deletedAt: new Date()
            },
            include: {
                author: { select: { id: true, username: true, avatarConfig: true } },
                community: true,
                _count: { select: { comments: true } }
            }
        });

        // Invalidate Cache
        await CacheService.del(CacheService.keys.thread(threadId));

        const voteData = await this.getThreadVoteStatus(updated, userId);
        const isSaved = await this.getThreadSaveStatus(updated.id, userId);

        return {
            id: updated.id,
            title: updated.title,
            content: updated.content,
            imageUrl: updated.imageUrl || undefined,
            upvotes: voteData.upvotes,
            downvotes: voteData.downvotes,
            netVotes: voteData.netVotes,
            hasVoted: voteData.userVote,
            isSaved,
            commentsCount: updated._count.comments,
            username: updated.username,
            communityName: updated.communityName,
            communityId: updated.communityId,
            communityImageUrl: updated.community.imageUrl,
            authorId: (updated.isAnonymous && updated.authorId !== userId) ? "" : updated.authorId,
            isAnonymous: updated.isAnonymous ?? false,
            allowAnonymous: updated.community.allowAnonymous,
            avatarConfig: (updated.isAnonymous && updated.authorId !== userId) ? null : updated.author.avatarConfig,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            isOwner: updated.authorId === userId
        };
    }

    static async getAllThreads(
        userId?: string,
        cursor?: string,
        limit: number = 20
    ): Promise<{ data: ThreadOutput[], nextCursor: string | null }> {
        const threads = await prisma.thread.findMany({
            where: { isDeleted: false },
            take: limit + 1,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            include: {
                author: { select: { id: true, username: true, avatarConfig: true } },
                community: true,
                _count: { select: { comments: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        let nextCursor: string | null = null;
        if (threads.length > limit) {
            const nextItem = threads.pop();
            nextCursor = nextItem!.id;
        }

        const threadsWithVotes = await Promise.all(
            threads.map(async (thread) => {
                const voteData = await this.getThreadVoteStatus(thread, userId);
                const isSaved = await this.getThreadSaveStatus(thread.id, userId);
                return {
                    id: thread.id,
                    title: thread.title,
                    content: thread.content,
                    imageUrl: thread.imageUrl || undefined,
                    upvotes: voteData.upvotes,
                    downvotes: voteData.downvotes,
                    netVotes: voteData.netVotes,
                    hasVoted: voteData.userVote,
                    isSaved,
                    commentsCount: thread._count.comments,
                    username: thread.username,
                    communityName: thread.communityName,
                    communityId: thread.communityId,
                    communityImageUrl: thread.community.imageUrl,
                    authorId: (thread.isAnonymous && thread.authorId !== userId) ? "" : thread.authorId,
                    isAnonymous: thread.isAnonymous ?? false,
                    allowAnonymous: thread.community.allowAnonymous,
                    avatarConfig: (thread.isAnonymous && thread.authorId !== userId) ? null : thread.author.avatarConfig,
                    createdAt: thread.createdAt.toISOString(),
                    updatedAt: thread.updatedAt.toISOString(),
                    isOwner: thread.authorId === userId
                };
            })
        );

        return {
            data: threadsWithVotes,
            nextCursor
        };
    }

    // VOTE ON THREAD
    static async voteThread(input: VoteInput, userId: string) {
        const { threadId, type } = input;

        // Verify thread exists
        const thread = await prisma.thread.findUnique({
            where: { id: threadId }
        });
        if (!thread) throw new Error("THREAD_NOT_FOUND");

        // Check if user already voted
        const existingVote = await prisma.threadVote.findUnique({
            where: {
                threadId_userId: {
                    threadId,
                    userId
                }
            }
        });

        let successAction = "";

        if (existingVote) {
            // Same vote = remove (toggle)
            if (existingVote.type === type) {
                await prisma.$transaction([
                    prisma.threadVote.delete({
                        where: { id: existingVote.id }
                    }),
                    prisma.thread.update({
                        where: { id: threadId },
                        data: type === "UP"
                            ? { upvotes: { decrement: 1 } }
                            : { downvotes: { decrement: 1 } }
                    })
                ]);
                successAction = "removed";
            } else {
                // Different vote = update (flip)
                await prisma.$transaction([
                    prisma.threadVote.update({
                        where: { id: existingVote.id },
                        data: { type }
                    }),
                    prisma.thread.update({
                        where: { id: threadId },
                        data: type === "UP"
                            ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 } }
                            : { downvotes: { increment: 1 }, upvotes: { decrement: 1 } }
                    })
                ]);
                successAction = "updated";
            }
        } else {
            // No existing vote = create
            await prisma.$transaction([
                prisma.threadVote.create({
                    data: { threadId, userId, type }
                }),
                prisma.thread.update({
                    where: { id: threadId },
                    data: type === "UP"
                        ? { upvotes: { increment: 1 } }
                        : { downvotes: { increment: 1 } }
                })
            ]);
            successAction = "voted";

            // Notify Author on Upvote (only if not self-vote)
            if (type === "UP") {
                try {
                    // Optimized: Don't fetch entire thread again if possible, but we need authorId
                    // We already fetched thread at start of function.
                    const voter = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });

                    if (thread.authorId !== userId && voter) {
                        const truncatedTitle = thread.title.length > 50 ? thread.title.substring(0, 50) + "..." : thread.title;

                        await NotificationService.createNotification({
                            content: `${voter.username} upvoted your thread: "${truncatedTitle}"`,
                            type: NotificationType.UPVOTED_THREAD,
                            status: NotificationStatus.UNREAD,
                            receiverId: thread.authorId,
                            senderId: userId,
                            threadId: threadId
                        });
                    }
                } catch (e) {
                    console.error("Failed to notify upvote", e);
                }
            }

        }

        // Recalculate Score (HotScore)
        const finalThread = await prisma.thread.findUnique({ where: { id: threadId } });
        if (finalThread) {
            const s = ScoreService.calculateHotScore(
                finalThread.upvotes,
                finalThread.downvotes,
                finalThread.createdAt,
                finalThread.commentsCount
            );
            await prisma.thread.update({ where: { id: threadId }, data: { hotScore: s } });
        }

        // Invalidate Cache (Important: votes changed)
        await CacheService.del(CacheService.keys.thread(threadId));

        // Return updated counts
        const updatedThread = await prisma.thread.findUnique({
            where: { id: threadId },
            select: { upvotes: true, downvotes: true }
        });

        return {
            success: true,
            action: successAction,
            upvotes: updatedThread?.upvotes || 0,
            downvotes: updatedThread?.downvotes || 0
        };

    }


    // REMOVE VOTE
    static async removeVote(threadId: string, userId: string) {
        const vote = await prisma.threadVote.findUnique({
            where: {
                threadId_userId: {
                    threadId,
                    userId
                }
            }
        });

        if (!vote) throw new Error("VOTE_NOT_FOUND");

        await prisma.$transaction([
            prisma.threadVote.delete({
                where: { id: vote.id }
            }),
            prisma.thread.update({
                where: { id: threadId },
                data: vote.type === "UP"
                    ? { upvotes: { decrement: 1 } }
                    : { downvotes: { decrement: 1 } }
            })
        ]);

        // Invalidate Cache
        await CacheService.del(CacheService.keys.thread(threadId));

        // Recalculate Score (HotScore)
        const finalThread = await prisma.thread.findUnique({ where: { id: threadId } });
        if (finalThread) {
            const s = ScoreService.calculateHotScore(
                finalThread.upvotes,
                finalThread.downvotes,
                finalThread.createdAt,
                finalThread.commentsCount
            );
            await prisma.thread.update({ where: { id: threadId }, data: { hotScore: s } });
        }

        return { success: true };
    }


    static async flagThread(threadId: string, userId: string) {
        const thread = await prisma.thread.findUnique({
            where: { id: threadId }
        });

        if (!thread) throw new Error("THREAD_NOT_FOUND");

        // Check if user is a member of the community?? 
        // Generally flagging is allowed by members.
        // Let's verify membership.
        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: {
                    userId,
                    communityId: thread.communityId
                }
            }
        });

        if (!membership) throw new Error("NOT_A_MEMBER");

        const updated = await prisma.thread.update({
            where: { id: threadId },
            data: { isFlagged: true }
        });

        // Invalidate Cache
        await CacheService.del(CacheService.keys.thread(threadId));

        return { success: true, isFlagged: updated.isFlagged };
    }

    static async getAllVotesOfUser(userId: string) {
        const votes = await prisma.threadVote.findMany({
            where: { userId },
            include: {
                thread: true,
                user: true
            }
        });
        return votes;
    }
}
