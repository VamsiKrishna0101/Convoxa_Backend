import prisma from "../../config/prisma";

import { AdminCommunityOutput, MakeModInput } from "./admin.types";

export class AdminService {

    static async getAdminCommunities(userId: string): Promise<AdminCommunityOutput[]> {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) throw new Error("USER_NOT_FOUND");

        const communities = await prisma.community.findMany({
            where: {
                ownerId: userId,
                isDeleted: false // Exclude deleted communities
            },
            include: {
                _count: {
                    select: { members: true }
                }
            }
        });

        return communities.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            topic: c.topic,
            visibility: c.visibility,
            imageUrl: c.imageUrl,
            memberCount: c._count.members
        }));
    }

    static async makeMod(input: MakeModInput, currentUserId: string) {
        const { targetUserId, communityId } = input;

        if (!targetUserId || !communityId) {
            throw new Error("INVALID_INPUT");
        }

        // 1️⃣ Check community & ownership
        const community = await prisma.community.findUnique({
            where: { id: communityId }
        });

        if (!community) throw new Error("COMMUNITY_NOT_FOUND");
        if (community.isDeleted) throw new Error("COMMUNITY_NOT_FOUND"); // Treat deleted as not found
        if (community.ownerId !== currentUserId) throw new Error("NOT_AUTHORIZED");

        // 2️⃣ Find membership
        const member = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: {
                    userId: targetUserId,
                    communityId
                }
            }
        });

        if (!member) throw new Error("USER_NOT_MEMBER");

        // 3️⃣ Promote to moderator
        const updated = await prisma.communityMember.update({
            where: {
                userId_communityId: {
                    userId: targetUserId,
                    communityId
                }
            },
            data: {
                role: "MODERATOR"
            }
        });

        return {
            success: true,
            role: updated.role
        };
    }


    static async getMembersOfCommunity(communityId: string) {
        if (!communityId) throw new Error("INVALID_INPUT");

        const members = await prisma.communityMember.findMany({
            where: {
                communityId
            },
            select: {
                userId: true,
                username: true,
                role: true,
                joinedAt: true
            }
        });
        console.log(members)
        return members;
    }

    static async getAllFlaggedThreadsOfCommunity(communityId: string, userId: string) {
        if (!communityId || !userId) throw new Error("INVALID_INPUT");

        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: {
                    userId,
                    communityId
                }
            }
        });

        if (!membership) throw new Error("NOT_A_MEMBER");
        if (membership.role !== "ADMIN" && membership.role !== "MODERATOR") throw new Error("NOT_AUTHORIZED");

        const threads = await prisma.thread.findMany({
            where: {
                communityId,
                isFlagged: true,
                isDeleted: false // Soft delete check
            },
            select: {
                id: true,
                title: true,
                content: true,
                authorId: true,
                username: true,
                createdAt: true,
                isFlagged: true
            }
        });
        return threads;
    }

    static async getAllReportsOfCommunity(communityId: string, userId: string) {
        if (!communityId || !userId) throw new Error("INVALID_INPUT");

        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: {
                    userId,
                    communityId
                }
            }
        });

        if (!membership) throw new Error("NOT_A_MEMBER");
        if (membership.role !== "ADMIN" && membership.role !== "MODERATOR") {
            throw new Error("NOT_AUTHORIZED");
        }

        const reports = await prisma.report.findMany({
            where: {
                communityId
            },
            select: {
                id: true,
                commentId: true,
                threadId: true,
                reporterId: true,
                reason: true,
                createdAt: true,
                thread: {
                    select: {
                        title: true,
                        content: true
                    }
                },
                comment: {
                    select: {
                        content: true
                    }
                },
                reporter: {
                    select: {
                        username: true
                    }
                }
            }
        });
        console.log(reports)
        return reports;
    }
}

