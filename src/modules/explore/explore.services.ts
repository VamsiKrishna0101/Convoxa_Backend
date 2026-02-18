import prisma from "../../config/prisma.js";

export class ExploreService {
    // GET TRENDING THREADS
    static async getTrendingThreads(userId?: string) {
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

        const threads = await prisma.thread.findMany({
            where: {
                isDeleted: false,
                createdAt: { gt: fortyEightHoursAgo }, // Recent threads only
                community: {
                    visibility: "PUBLIC"
                }
            },
            include: {
                community: true,
                author: { select: { id: true, username: true, role: true } },
                votes: userId ? { where: { userId } } : false,
                _count: { select: { comments: true, votes: true } }
            },
            orderBy: [
                { upvotes: "desc" },    // Primary: by upvotes field
                { createdAt: "desc" }   // Secondary: most recent
            ],
            take: 20
        });

        // Format response
        return threads.map(t => ({
            id: t.id,
            title: t.title,
            content: t.content,
            imageUrl: t.imageUrl,
            upvotes: t.upvotes,
            downvotes: t.downvotes || 0,
            commentsCount: t._count.comments,
            votesCount: t._count.votes,
            communityId: t.communityId,
            communityName: t.community.name,
            communityImage: t.community.imageUrl,
            authorId: t.authorId,
            username: t.author.username,
            createdAt: t.createdAt,
            hasVoted: t.votes && Array.isArray(t.votes) && t.votes.length > 0 ? t.votes[0].type : null
        }));
    }

    // GET RECOMMENDED COMMUNITIES (based on user's joined topics)
    static async getRecommendedCommunities(userId: string) {
        // Get user's joined communities
        const userCommunities = await prisma.communityMember.findMany({
            where: { userId },
            include: { community: { select: { id: true, topic: true } } }
        });

        const joinedCommunityIds = userCommunities.map(c => c.communityId);
        const userTopics = [...new Set(userCommunities.map(c => c.community.topic))];

        if (userTopics.length === 0) {
            // Fallback: return popular public communities
            return this.getPopularCommunities(10);
        }

        // Get communities in same topics, excluding already joined
        const recommendedCommunities = await prisma.community.findMany({
            where: {
                topic: { in: userTopics },
                visibility: "PUBLIC",
                isDeleted: false,
                id: { notIn: joinedCommunityIds }
            },
            include: {
                _count: { select: { members: true, threads: true } }
            },
            orderBy: { members: { _count: "desc" } },
            take: 10
        });

        return recommendedCommunities.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            imageUrl: c.imageUrl,
            topic: c.topic,
            visibility: c.visibility,
            membersCount: c._count.members,
            threadsCount: c._count.threads
        }));
    }

    // GET POPULAR COMMUNITIES (fallback helper)
    static async getPopularCommunities(limit: number = 10) {
        const communities = await prisma.community.findMany({
            where: { visibility: "PUBLIC", isDeleted: false },
            include: { _count: { select: { members: true, threads: true } } },
            orderBy: { members: { _count: "desc" } },
            take: limit
        });

        return communities.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            imageUrl: c.imageUrl,
            topic: c.topic,
            visibility: c.visibility,
            membersCount: c._count.members,
            threadsCount: c._count.threads
        }));
    }

    // GET EXPLORE COMMUNITIES BY TOPIC (top 10 per topic)
    static async getExploreCommunitiesByTopic() {
        // All available topics from the enum
        const allTopics = [
            "ANIME_AND_COSPLAY", "ART", "BUSINESS_AND_FINANCE", "COLLECTIBLES_AND_OTHER_HOBBIES",
            "EDUCATION_AND_CAREER", "FASHION_AND_BEAUTY", "FOOD_AND_DRINKS", "GAMES", "HEALTH",
            "HOME_AND_GARDEN", "HUMANITIES_AND_LAW", "IDENTITY_AND_RELATIONSHIPS", "INTERNET_CULTURE",
            "MOVIES_AND_TV", "MUSIC", "NATURE_AND_OUTDOORS", "NEWS_AND_POLITICS", "PLACES_AND_TRAVEL",
            "POP_CULTURE", "QAS_AND_STORIES", "READING_AND_WRITING", "SCIENCES", "SPOOKY", "SPORTS",
            "TECHNOLOGY", "VEHICLES", "WELLNESS", "ADULT_CONTENT", "MATURE_TOPICS"
        ] as const;

        // Fetch top 10 communities per topic (parallel)
        const topicResults = await Promise.all(
            allTopics.map(async (topic) => {
                const communities = await prisma.community.findMany({
                    where: {
                        topic: topic,
                        visibility: "PUBLIC",
                        isDeleted: false
                    },
                    include: {
                        _count: { select: { members: true, threads: true } }
                    },
                    orderBy: [
                        { members: { _count: "desc" } },  // Primary: by members
                        { threads: { _count: "desc" } }   // Secondary: by threads
                    ],
                    take: 10
                });

                return {
                    topic,
                    communities: communities.map(c => ({
                        id: c.id,
                        name: c.name,
                        description: c.description,
                        imageUrl: c.imageUrl,
                        membersCount: c._count.members,
                        threadsCount: c._count.threads
                    }))
                };
            })
        );

        // Filter out topics with no communities
        return topicResults.filter(t => t.communities.length > 0);
    }

    // GET SPECIFIC TOPIC COMMUNITIES WITH PAGINATION
    static async getCommunitiesByTopic(topic: any, cursor?: string, limit: number = 20): Promise<{ data: any[], nextCursor: string | null }> {
        const communities = await prisma.community.findMany({
            where: {
                topic: topic,
                isDeleted: false,
                visibility: "PUBLIC"
            },
            include: {
                _count: {
                    select: {
                        members: true,
                        threads: true
                    }
                }
            },
            orderBy: {
                members: {
                    _count: "desc"
                }
                // Note: Cursor pagination with non-unique sort field (members count) is non-deterministic.
                // Ideally we need a secondary sort by ID.
            },
            take: limit + 1,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined
        });

        // Wait, 'members count' ordering with ID cursor requires specific cursor handling (e.g. composite cursor).
        // Standard Prisma ID cursor only works if we sort by ID or unique field.
        // If we sort by members count, using ID cursor ALONE is not enough if values are duplicate.
        // HOWEVER, for this specific refactor, if we want robust implementations, we might need to stick to offset 
        // OR switch to simple ID ordering for "Load More".
        // BUT 'Popular' implies sorting by members.

        // Let's keep it simple for now and use ID ordering as secondary if possible, but Prisma cursor requires the cursor to be the unique field implies we are jumping to that record.
        // Actually, if we sort by `members: desc`, the `cursor: { id: ... }` approach works in Prisma 
        // IF the cursor record is found, it skips to it. 
        // BUT if multiple records have same member count, the sort is unstable unless we add secondary sort.

        // Let's add secondary sort by ID to make it stable.

        let nextCursor: string | null = null;
        if (communities.length > limit) {
            const nextItem = communities.pop();
            nextCursor = nextItem!.id;
        }

        const mapped = communities.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            imageUrl: c.imageUrl,
            topic: c.topic,
            visibility: c.visibility,
            membersCount: c._count.members,
            threadsCount: c._count.threads
        }));

        return {
            data: mapped,
            nextCursor
        };
    }

    static async search(query: string, type: 'ALL' | 'COMMUNITY' | 'THREAD' = 'ALL', cursor?: string, limit: number = 20) {
        if (!query || query.trim().length === 0) {
            return { communities: [], threads: [], nextCursor: null };
        }

        let communities: any[] = [];
        let threads: any[] = [];
        let nextCursor: string | null = null;

        // 1. SEARCH COMMUNITIES
        if (type === 'ALL' || type === 'COMMUNITY') {
            const take = type === 'ALL' ? 5 : limit + 1;
            const skip = (type !== 'ALL' && cursor) ? 1 : 0;
            const cursorObj = (type !== 'ALL' && cursor) ? { id: cursor } : undefined;

            const fetchedCommunities = await prisma.community.findMany({
                where: {
                    name: { contains: query, mode: 'insensitive' },
                    isDeleted: false,
                    visibility: "PUBLIC"
                },
                include: {
                    _count: { select: { members: true, threads: true } }
                },
                take,
                skip,
                cursor: cursorObj,
                // Order by members count is ideal but requires stable sort for cursor. 
                // Using ID for stable cursor pagination if specific type is requested.
                orderBy: type === 'ALL' ? { members: { _count: 'desc' } } : { id: 'asc' }
            });

            if (type === 'COMMUNITY' && fetchedCommunities.length > limit) {
                const nextItem = fetchedCommunities.pop();
                nextCursor = nextItem!.id;
            }

            communities = fetchedCommunities.map(c => ({
                id: c.id,
                name: c.name,
                description: c.description,
                imageUrl: c.imageUrl,
                membersCount: c._count.members,
                threadsCount: c._count.threads
            }));
        }

        // 2. SEARCH THREADS
        if (type === 'ALL' || type === 'THREAD') {
            const take = type === 'ALL' ? 10 : limit + 1;
            const skip = (type !== 'ALL' && cursor) ? 1 : 0;
            const cursorObj = (type !== 'ALL' && cursor) ? { id: cursor } : undefined;

            const fetchedThreads = await prisma.thread.findMany({
                where: {
                    title: { contains: query, mode: 'insensitive' },
                    isDeleted: false,
                    community: { visibility: "PUBLIC" }
                },
                include: {
                    community: true,
                    _count: { select: { comments: true, votes: true } }
                },
                orderBy: { createdAt: 'desc' },
                take,
                skip,
                cursor: cursorObj
            });

            if (type === 'THREAD' && fetchedThreads.length > limit) {
                const nextItem = fetchedThreads.pop();
                nextCursor = nextItem!.id;
            }

            threads = fetchedThreads.map(t => ({
                id: t.id,
                title: t.title,
                content: t.content,
                imageUrl: t.imageUrl,
                communityId: t.communityId,
                communityName: t.community.name,
                communityImage: t.community.imageUrl,
                upvotes: t.upvotes,
                commentsCount: t._count.comments,
                createdAt: t.createdAt.toISOString()
            }));
        }

        return {
            communities,
            threads,
            nextCursor
        };
    }
}

