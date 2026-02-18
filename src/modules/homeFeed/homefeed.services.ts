import prisma from "../../config/prisma"
import { CursorHelper } from "../common/cursor.helper";
import { CacheService } from "../common/cache.service";


export class HomeFeedService {
    static async getHomeFeed(userId: string, cursorStr?: string, limit: number = 20, sortBy: 'HOT' | 'NEW' | 'TOP' | 'smart' = 'NEW') {
        // Decode Query Cursor (j=joined, f=following, s=similar, t=trending)
        const cursorState = cursorStr ? CursorHelper.decode(cursorStr) : { j: null, f: null, s: null, t: null };

        if (!cursorState) throw new Error("INVALID_CURSOR");

        // Guard: Exhausted
        if (cursorState.j === "DONE" && cursorState.f === "DONE" && cursorState.s === "DONE" && cursorState.t === "DONE") {
            return { data: [], nextCursor: null };
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

        const joinedCommunityIds = joinedCommunities.map(m => m.communityId);
        const joinedTopics = [...new Set(joinedCommunities.map(m => m.community.topic).filter(t => t !== null))]; // Ensure no nulls
        const followingIds = following.map(f => f.followingId);

        // 2. Define Limits (Target: 50% J, 20% F, 20% S, 10% T)
        let targetJ = Math.ceil(limit * 0.5); // 10
        let targetF = Math.ceil(limit * 0.2); // 4
        let targetS = Math.ceil(limit * 0.2); // 4
        let targetT = limit - (targetJ + targetF + targetS); // 2

        // Check availability to reallocate quotas immediately (Cold Start / Empty States)
        const hasJoined = joinedCommunityIds.length > 0;
        const hasFollowing = followingIds.length > 0;
        const hasTopics = joinedTopics.length > 0;

        if (!hasJoined) {
            targetF += targetJ;
            targetJ = 0;
        }
        if (!hasFollowing) {
            targetS += targetF;
            targetF = 0;
        }
        if (!hasTopics) {
            targetT += targetS;
            targetS = 0;
        }
        // If everything is empty, targetT becomes 20 (limit)

        // 3. Sort Config
        let orderBy: any = [];
        if (sortBy === 'HOT' || sortBy === 'smart') {
            orderBy = [{ hotScore: 'desc' }, { id: 'desc' }];
        } else if (sortBy === 'TOP') {
            orderBy = [{ upvotes: 'desc' }, { id: 'desc' }];
        } else {
            orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];
        }

        // Helper to Fetch Stream
        const fetchStream = async (whereCondition: any, streamLimit: number, streamCursor?: any) => {
            if (streamLimit <= 0 || streamCursor === "DONE") return [];

            const query: any = {
                where: { ...whereCondition, isDeleted: false },
                take: streamLimit + 2, // Fetch extra for lookahead AND in-memory dedupe buffer
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

            if (streamCursor && streamCursor !== "DONE") {
                query.cursor = { id: streamCursor };
                query.skip = 1;
            }

            return await prisma.thread.findMany(query);
        };

        // 4. Parallel Fetch (No "NOT IN" calls to DB for speed)
        const [rawJoined, rawFollowing, rawSimilar, rawTrending] = await Promise.all([
            // Stream J: Joined Communities
            fetchStream(
                { communityId: { in: joinedCommunityIds } },
                targetJ, cursorState.j
            ),
            // Stream F: Following Users (author is followed, community is public)
            fetchStream(
                { authorId: { in: followingIds }, community: { visibility: 'PUBLIC' } },
                targetF, cursorState.f
            ),
            // Stream S: Similar Topics (exclude joined communities to ensure variety)
            fetchStream(
                { community: { topic: { in: joinedTopics as string[] }, id: { notIn: joinedCommunityIds }, visibility: 'PUBLIC' } },
                targetS, cursorState.s
            ),
            // Stream T: Trending/All (Public only)
            fetchStream(
                { community: { visibility: 'PUBLIC' } },
                targetT, cursorState.t
            )
        ]);

        // 5. Deduplication & Composition
        const seenIds = new Set<string>();
        const finalFeed: any[] = [];

        // Helper to process a stream and update cursors/quotas
        const processStream = (
            rawItems: any[],
            targetCount: number,
            cursorKey: string,
            nextState: any
        ) => {
            const accepted: any[] = [];
            let nextCursor = "DONE";

            for (const item of rawItems) {
                if (accepted.length >= targetCount) {
                    // We found enough items, this next item is our cursor for next time
                    nextCursor = item.id;
                    break;
                }
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    accepted.push(item);
                }
            }

            // If we ran out of items before hitting limit + 1 (cursor), we are DONE
            if (rawItems.length < targetCount + 1 && nextCursor === "DONE") {
                nextCursor = "DONE";
            }
            // If we have items but fewer than target, we might be DONE if raw length is small
            if (rawItems.length === 0) nextCursor = "DONE";


            nextState[cursorKey] = nextCursor;
            finalFeed.push(...accepted);
            return targetCount - accepted.length; // Return deficit
        };

        const nextCursorState: any = { j: "DONE", f: "DONE", s: "DONE", t: "DONE" };

        // Process in Priority Order (Spilling deficits down)
        let deficit = processStream(rawJoined, targetJ, 'j', nextCursorState);

        targetF += deficit; // Spill J -> F
        deficit = processStream(rawFollowing, targetF, 'f', nextCursorState);

        targetS += deficit; // Spill F -> S
        deficit = processStream(rawSimilar, targetS, 's', nextCursorState);

        targetT += deficit; // Spill S -> T
        processStream(rawTrending, targetT, 't', nextCursorState);


        // 6. Final Sort (Shuffle/Mix)
        // We re-sort the combined list to ensure the user sees a mix, rather than blocks of "Joined" then "Following".
        if (sortBy === 'HOT' || sortBy === 'smart') {
            finalFeed.sort((a, b) => (b.hotScore || 0) - (a.hotScore || 0));
        } else if (sortBy === 'TOP') {
            finalFeed.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
        } else {
            finalFeed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        const allStreamsFinished =
            nextCursorState.j === "DONE" &&
            nextCursorState.f === "DONE" &&
            nextCursorState.s === "DONE" &&
            nextCursorState.t === "DONE";

        // console.log(`Feed generated: ${finalFeed.length} items. J:${targetJ} F:${targetF} S:${targetS} T:${targetT}`);

        return {
            data: finalFeed.map(t => ({
                id: t.id,
                title: t.title,
                content: t.content.length > 300 ? t.content.substring(0, 300) + "..." : t.content,
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
            nextCursor: allStreamsFinished ? null : CursorHelper.encode(nextCursorState)
        };
    }
}

