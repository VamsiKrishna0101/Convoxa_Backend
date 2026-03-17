import prisma from "../../config/prisma.js"
import { CursorHelper } from "../common/cursor.helper.js";


export class HomeFeedService {
    static async getHomeFeed(userId: string, cursorStr?: string, limit: number = 20, sortBy: 'HOT' | 'NEW' | 'TOP' | 'smart' = 'NEW') {
        // Decode Query Cursor
        let pCursorId: string | undefined = undefined;
        let dCursorId: string | undefined = undefined;

        if (cursorStr) {
            const decoded = CursorHelper.decode(cursorStr);
            if (typeof decoded === 'string' && decoded.includes('|')) {
                const [p, d] = decoded.split('|');
                pCursorId = p === 'null' ? undefined : p;
                dCursorId = d === 'null' ? undefined : d;
            } else if (typeof decoded === 'string') {
                // Fallback for old single cursor
                pCursorId = decoded;
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
            // NEW
            orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];
        }

        // 3. Construct Personalized OR Conditions
        const personalizedConditions: any[] = [];

        if (joinedCommunityIds.length > 0) {
            personalizedConditions.push({ communityId: { in: joinedCommunityIds } });
        }
        if (followingIds.length > 0) {
            personalizedConditions.push({
                authorId: { in: followingIds },
                community: { visibility: 'PUBLIC' }
            });
        }
        if (joinedTopics.length > 0) {
            personalizedConditions.push({
                community: {
                    topic: { in: joinedTopics },
                    id: { notIn: joinedCommunityIds },
                    visibility: 'PUBLIC'
                }
            });
        }

        // 4. Feeds Data Structure Setup
        const selectFields = {
            id: true, title: true, content: true, imageUrl: true,
            upvotes: true, downvotes: true, createdAt: true,
            hotScore: true, isAnonymous: true, authorId: true, communityId: true,
            isNSFW: true,
            community: { select: { id: true, name: true, imageUrl: true, topic: true, allowAnonymous: true } },
            author: { select: { id: true, username: true, role: true, avatarConfig: true } },
            votes: { where: { userId }, select: { type: true } },
            _count: { select: { comments: true } }
        };

        const personalizedLimit = Math.ceil(limit * 0.7);
        const discoveryLimit = limit - personalizedLimit;

        // 5. Fetch Personalized Feed
        let personalizedRaw: any[] = [];
        if (personalizedConditions.length > 0) {
            const pQuery: any = {
                where: { isDeleted: false, OR: personalizedConditions },
                take: personalizedLimit + 1,
                orderBy: orderBy,
                select: selectFields
            };
            if (pCursorId) {
                pQuery.cursor = { id: pCursorId };
                pQuery.skip = 1;
            }
            personalizedRaw = await prisma.thread.findMany(pQuery);
        }

        // 6. Fetch Discovery Feed (Public communities not explicitly followed/joined)
        const discoveryConditions = [
            { community: { visibility: 'PUBLIC' } }
        ];

        // If we want pure discovery, we can exclude personalized stuff, but it's okay if there's minor overlap.
        // For strictness, exclude joined communities.
        const discoveryQuery: any = {
            where: { isDeleted: false, communityId: { notIn: joinedCommunityIds }, community: { visibility: 'PUBLIC' } },
            take: discoveryLimit + 1,
            orderBy: orderBy,
            select: selectFields
        };
        if (dCursorId) {
            discoveryQuery.cursor = { id: dCursorId };
            discoveryQuery.skip = 1;
        }
        const discoveryRaw = await prisma.thread.findMany(discoveryQuery);

        // 7. Calculate Cursors & Slice
        let nextPCursor: string | null = null;
        if (personalizedRaw.length > personalizedLimit) {
            const nextItem = personalizedRaw.pop();
            nextPCursor = nextItem ? nextItem.id : null;
        } else if (personalizedRaw.length > 0) {
            nextPCursor = personalizedRaw[personalizedRaw.length - 1].id;
        }

        let nextDCursor: string | null = null;
        if (discoveryRaw.length > discoveryLimit) {
            const nextItem = discoveryRaw.pop();
            nextDCursor = nextItem ? nextItem.id : null;
        } else if (discoveryRaw.length > 0) {
            nextDCursor = discoveryRaw[discoveryRaw.length - 1].id;
        }

        let hasMore = (personalizedRaw.length === personalizedLimit && nextPCursor !== null) ||
            (discoveryRaw.length === discoveryLimit && nextDCursor !== null);

        // Filter duplicates if any
        const pIds = new Set(personalizedRaw.map(t => t.id));
        const cleanDiscoveryRaw = discoveryRaw.filter(t => !pIds.has(t.id));

        // 8. Blend and Sort In-Memory
        const blendedFeed = [...personalizedRaw, ...cleanDiscoveryRaw];

        blendedFeed.sort((a, b) => {
            if (sortBy === 'HOT' || sortBy === 'smart') {
                if (b.hotScore !== a.hotScore) return b.hotScore - a.hotScore;
                return b.id.localeCompare(a.id);
            } else if (sortBy === 'TOP') {
                if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
                return b.id.localeCompare(a.id);
            } else {
                // NEW
                const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                if (timeDiff !== 0) return timeDiff;
                return b.id.localeCompare(a.id);
            }
        });

        // Ensure we don't accidentally return more than 'limit' items if deduplication failed
        const finalFeed = blendedFeed.slice(0, limit);

        const nextCursorStr = hasMore ? `${nextPCursor || 'null'}|${nextDCursor || 'null'}` : null;

        return {
            data: finalFeed.map((t: any) => ({
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
                authorId: (t.isAnonymous && t.authorId !== userId) ? "" : t.authorId,
                username: (t.isAnonymous && t.authorId !== userId) ? "Anonymous" : t.author.username,
                authorRole: t.author.role,
                createdAt: new Date(t.createdAt).toISOString(),
                hasVoted: t.votes && t.votes.length > 0 ? (t.votes[0] as any).type : null,
                hotScore: t.hotScore,
                avatarConfig: (t.isAnonymous && t.authorId !== userId) ? null : t.author.avatarConfig,
                isAnonymous: t.isAnonymous ?? false,
                isNSFW: t.isNSFW ?? false,
                isOwner: t.authorId === userId
            })),
            nextCursor: nextCursorStr ? CursorHelper.encode(nextCursorStr) : null
        };
    }
}
