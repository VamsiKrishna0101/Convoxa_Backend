import prisma from "../../config/prisma.js"
import { CursorHelper } from "../common/cursor.helper.js";


export class HomeFeedService {
    static async getHomeFeed(userId: string, cursorStr?: string, limit: number = 20, sortBy: 'HOT' | 'NEW' | 'TOP' | 'smart' = 'NEW') {
        // Decode Query Cursor
        let cursorId: string | undefined = undefined;
        if (cursorStr) {
            const decoded = CursorHelper.decode(cursorStr);
            if (typeof decoded === 'string') {
                cursorId = decoded;
            } else {
                // Ignore old Object cursor formats if they somehow exist in client storage
                cursorId = undefined;
            }
        }

        // 1. Get User Context
        const [joinedCommunities, following] = await Promise.all([
            prisma.communityMember.findMany({
                where: { userId },
                include: { community: { select: { id: true, topic: true } } }
            }),
            prisma.userFollow.findMany({
                where: { followerId: userId },
                select: { followingId: true }
            })
        ]);

        const joinedCommunityIds = joinedCommunities.map((m: any) => m.communityId);
        const joinedTopics = [...new Set(joinedCommunities.map((m: any) => m.community.topic).filter((t: any) => t !== null))] as string[];
        const followingIds = following.map((f: any) => f.followingId);

        // 2. Sort Config
        let orderBy: any = [];
        if (sortBy === 'HOT' || sortBy === 'smart') {
            orderBy = [{ hotScore: 'desc' }, { id: 'desc' }];
        } else if (sortBy === 'TOP') {
            orderBy = [{ upvotes: 'desc' }, { id: 'desc' }];
        } else {
            orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];
        }

        // 3. Construct Unified OR Conditions
        const OR_conditions: any[] = [];

        // J: Joined Communities
        if (joinedCommunityIds.length > 0) {
            OR_conditions.push({ communityId: { in: joinedCommunityIds } });
        }

        // F: Following Users
        if (followingIds.length > 0) {
            OR_conditions.push({
                authorId: { in: followingIds },
                community: { visibility: 'PUBLIC' }
            });
        }

        // S: Similar Topics
        if (joinedTopics.length > 0) {
            OR_conditions.push({
                community: {
                    topic: { in: joinedTopics },
                    id: { notIn: joinedCommunityIds },
                    visibility: 'PUBLIC'
                }
            });
        }

        // If user is completely brand new (no joined, no following, no topics) -> Fallback to all Public
        if (OR_conditions.length === 0) {
            OR_conditions.push({ community: { visibility: 'PUBLIC' } });
        }

        // 4. Fetch the single consolidated stream
        const query: any = {
            where: { isDeleted: false, OR: OR_conditions },
            take: limit + 1, // Fetch extra for lookahead (to check if there's a next page)
            orderBy: orderBy,
            select: {
                id: true,
                title: true,
                content: true,
                imageUrl: true,
                upvotes: true,
                downvotes: true,
                createdAt: true,
                hotScore: true,
                isAnonymous: true,
                authorId: true,
                communityId: true,
                community: {
                    select: {
                        id: true,
                        name: true,
                        imageUrl: true,
                        topic: true,
                        allowAnonymous: true
                    }
                },
                author: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                        avatarConfig: true
                    }
                },
                votes: { where: { userId }, select: { type: true } },
                _count: { select: { comments: true } }
            }
        };

        if (cursorId) {
            query.cursor = { id: cursorId };
            query.skip = 1;
        }

        const rawFeed = await prisma.thread.findMany(query);

        // 5. Deduplication & Composition processing
        let nextCursor: string | null = null;
        const feedToReturn = rawFeed;

        // If we got limit + 1, then we have a next cursor. Pop the last item off to keep returned array strictly at length `limit`
        if (feedToReturn.length > limit) {
            const nextItem = feedToReturn.pop();
            nextCursor = nextItem ? nextItem.id : null;
        }

        return {
            data: feedToReturn.map((t: any) => ({
                id: t.id,
                title: t.title,
                content: t.content,
                imageUrl: t.imageUrl,
                upvotes: t.upvotes,
                downvotes: t.downvotes || 0,
                netVotes: t.upvotes - (t.downvotes || 0),
                commentsCount: t._count ? t._count.comments : 0,
                communityId: t.communityId,
                communityName: t.community.name,
                communityImage: t.community.imageUrl,
                authorId: (t.isAnonymous) ? "" : t.authorId,
                username: (t.isAnonymous) ? "Anonymous" : t.author.username,
                authorRole: t.author.role,
                createdAt: new Date(t.createdAt).toISOString(),
                hasVoted: t.votes && t.votes.length > 0 ? (t.votes[0] as any).type : null,
                hotScore: t.hotScore,
                avatarConfig: (t.isAnonymous) ? null : t.author.avatarConfig,
                isAnonymous: t.isAnonymous ?? false
            })),
            nextCursor: nextCursor ? CursorHelper.encode(nextCursor) : null
        };
    }
}
