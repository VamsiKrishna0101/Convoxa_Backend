import { CommunityInput, CommunityOutput, CommunityRuleInput, CommunityRuleOutput } from "./community.types.js";
import { CommunityTopic, CommunityVisibility } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { CacheService, CACHE_TTL } from "../common/cache.service.js";
import crypto from "crypto";

export class CommunityService {

    static async createCommunity(
        input: CommunityInput,
        userId: string
    ): Promise<CommunityOutput> {
        const { name, description, topic, visibility = "PUBLIC", allowAnonymous = false, imageUrl } = input;

        // Validate imageUrl is provided (required field)
        if (!imageUrl) {
            throw new Error("IMAGE_URL_REQUIRED");
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }

        const existingCommunity = await prisma.community.findUnique({
            where: { name },
        });

        if (existingCommunity) {
            throw new Error("COMMUNITY_NAME_EXISTS");
        }

        // Auto-generate joinCode for PRIVATE communities
        const joinCode = visibility === "PRIVATE" ? crypto.randomBytes(4).toString("hex").toUpperCase() : null;

        const community = await prisma.community.create({
            data: {
                name,
                description,
                topic: topic as CommunityTopic,
                visibility: visibility as CommunityVisibility,
                allowAnonymous,
                joinCode,
                imageUrl,
                ownerId: userId,
                members: {
                    create: {
                        userId,
                        role: "ADMIN", // creator becomes admin
                        username: user.username
                    },
                },
            },
        });

        // Invalidate User Communities Cache (since they just joined one)
        await CacheService.del(CacheService.keys.userCommunities(userId));

        return {
            id: community.id,
            name: community.name,
            description: community.description,
            topic: community.topic,
            visibility: community.visibility,
            allowAnonymous: community.allowAnonymous,
            joinCode: community.joinCode,
            imageUrl: community.imageUrl,
        };
    }

    static async updateCommunity(
        input: CommunityInput,
        userId: string,
        communityId: string
    ) {
        const { name, description, topic, visibility, allowAnonymous, imageUrl } = input;

        // 1️⃣ Check user
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }

        // 2️⃣ Check community
        const community = await prisma.community.findUnique({
            where: { id: communityId }
        });

        if (!community) {
            throw new Error("COMMUNITY_NOT_FOUND");
        }

        // 3️⃣ Authorization: only owner can update
        if (community.ownerId !== userId) {
            throw new Error("NOT_AUTHORIZED");
        }

        // 4️⃣ Build update object safely
        const updateData: any = {};

        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (topic) updateData.topic = topic as CommunityTopic;
        if (visibility) updateData.visibility = visibility as CommunityVisibility;
        if (allowAnonymous !== undefined) updateData.allowAnonymous = allowAnonymous;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

        // If switching to PRIVATE and no joinCode exists, generate one
        if (visibility === "PRIVATE" && !community.joinCode) {
            updateData.joinCode = crypto.randomBytes(4).toString("hex").toUpperCase();
        }

        // 5️⃣ Update using Prisma
        const updatedCommunity = await prisma.community.update({
            where: { id: communityId },
            data: updateData as any
        });

        // 6️⃣ Invalidate Cache
        await CacheService.del(CacheService.keys.community(communityId));

        // 6️⃣ Return clean response
        return {
            id: updatedCommunity.id,
            name: updatedCommunity.name,
            description: updatedCommunity.description,
            topic: updatedCommunity.topic,
            visibility: updatedCommunity.visibility,
            allowAnonymous: updatedCommunity.allowAnonymous,
            joinCode: updatedCommunity.joinCode,
            imageUrl: updatedCommunity.imageUrl
        };
    }

    static async deleteCommunity(
        userId: string,
        communityId: string
    ) {
        // 1️⃣ Check user
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error("USER NOT FOUND");
        }

        // 2️⃣ Check community
        const community = await prisma.community.findUnique({
            where: { id: communityId }
        });

        if (!community) {
            throw new Error("COMMUNITY NOT FOUND");
        }

        // 3️⃣ Authorization: only owner can delete
        if (community.ownerId !== userId) {
            throw new Error("NOT AUTHORIZED");
        }

        // 4️⃣ Soft Delete community
        await prisma.community.update({
            where: { id: communityId },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                name: `deleted_${Date.now()}_${community.name}`, // Free up the name
                description: "[deleted]",
                imageUrl: "https://storage.googleapis.com/adda-community-images-prod/deleted-placeholder.png"
            }
        });

        // 5️⃣ Invalidate Cache (Community & potentially user lists if we fetch deleted ones, but safer to clear)
        await CacheService.del(CacheService.keys.community(communityId));

        return { success: true };
    }



    static async joinCommunity(userId: string, communityId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("USER_NOT_FOUND");

        const community = await prisma.community.findUnique({
            where: { id: communityId }
        });
        if (!community) throw new Error("COMMUNITY_NOT_FOUND");

        // Block direct join for PRIVATE communities — must use joinByCode
        if (community.visibility === "PRIVATE") {
            throw new Error("PRIVATE_COMMUNITY_USE_CODE");
        }

        const existing = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: { userId, communityId }
            }
        });

        if (existing) throw new Error("ALREADY_MEMBER");

        await prisma.communityMember.create({
            data: {
                userId,
                communityId,
                role: "MEMBER",
                username: user.username
            }
        });

        // Invalidate User's Community List
        await CacheService.del(CacheService.keys.userCommunities(userId));
        // Invalidate Community Details (Member Count Changed)
        await CacheService.del(CacheService.keys.community(communityId));

        return { success: true };
    }

    // Join a PRIVATE community using its join code
    static async joinByCode(userId: string, joinCode: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("USER_NOT_FOUND");

        const community = await prisma.community.findFirst({
            where: { joinCode: joinCode.toUpperCase() }
        });
        if (!community) throw new Error("INVALID_JOIN_CODE");

        const existing = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: { userId, communityId: community.id }
            }
        });
        if (existing) throw new Error("ALREADY_MEMBER");

        await prisma.communityMember.create({
            data: {
                userId,
                communityId: community.id,
                role: "MEMBER",
                username: user.username
            }
        });

        // Invalidate caches
        await CacheService.del(CacheService.keys.userCommunities(userId));
        await CacheService.del(CacheService.keys.community(community.id));

        return {
            success: true,
            communityId: community.id,
            communityName: community.name
        };
    }

    static async leaveCommunity(userId: string, communityId: string) {
        const community = await prisma.community.findUnique({
            where: { id: communityId }
        });
        if (!community) throw new Error("COMMUNITY_NOT_FOUND");

        // 🚨 Owner cannot leave
        if (community.ownerId === userId) {
            throw new Error("OWNER_CANNOT_LEAVE");
        }

        const member = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: { userId, communityId }
            }
        });

        if (!member) throw new Error("NOT_A_MEMBER");

        await prisma.communityMember.delete({
            where: {
                userId_communityId: { userId, communityId }
            }
        });

        // Invalidate User's Community List
        await CacheService.del(CacheService.keys.userCommunities(userId));
        // Invalidate Community Details (Member Count Changed)
        await CacheService.del(CacheService.keys.community(communityId));

        return { success: true };
    }





    static async getUserCommunities(userId: string) {
        const cacheKey = CacheService.keys.userCommunities(userId);
        const cached = await CacheService.get<any[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) throw new Error("USER_NOT_FOUND");

        const memberships = await prisma.communityMember.findMany({
            where: { userId },
            include: {
                community: true
            }
        });

        const result = memberships.map((m: any) => ({
            role: m.role,
            isMuted: m.isMuted,
            community: m.community
        }));

        await CacheService.set(cacheKey, result, CACHE_TTL.USER_COMMUNITIES);

        return result;
    }


    static async getCommunityById(communityId: string) {
        const cacheKey = CacheService.keys.community(communityId);
        const cached = await CacheService.get<any>(cacheKey);

        if (cached) {
            return cached;
        }

        const community = await prisma.community.findUnique({
            where: { id: communityId },
            include: {
                _count: {
                    select: {
                        members: true,
                        threads: true
                    }
                }
            }
        });

        if (!community) throw new Error("COMMUNITY_NOT_FOUND");

        const result = {
            id: community.id,
            name: community.name,
            description: community.description,
            topic: community.topic,
            visibility: community.visibility,
            allowAnonymous: community.allowAnonymous,
            joinCode: community.joinCode,
            imageUrl: community.imageUrl,
            ownerId: community.ownerId,
            memberCount: community._count.members,
            threadCount: community._count.threads,
            createdAt: community.createdAt.toISOString(),
            updatedAt: community.updatedAt.toISOString()
        };

        // Cache the result
        await CacheService.set(cacheKey, result, CACHE_TTL.COMMUNITY_DETAILS);

        return result;
    }


    static async CreateCommunityRule(
        input: CommunityRuleInput,
        userId: string
    ): Promise<CommunityRuleOutput> {

        const {
            title,
            description,
            order,
            communityId,
            keywords = [],
            appliesTo = "POST"
        } = input;

        if (!title || order === undefined) {
            throw new Error("INVALID_INPUT");
        }

        const community = await prisma.community.findUnique({
            where: { id: communityId }
        });
        if (!community) throw new Error("COMMUNITY_NOT_FOUND");

        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: { userId, communityId }
            }
        });

        if (!membership) throw new Error("NOT_A_MEMBER");
        if (membership.role !== "ADMIN" && membership.role !== "MODERATOR") {
            throw new Error("NOT_AUTHORIZED");
        }

        // 🔒 Ensure no order collision
        const existingOrder = await prisma.communityRule.findFirst({
            where: { communityId, order }
        });

        if (existingOrder) {
            throw new Error("RULE_ORDER_ALREADY_EXISTS");
        }

        const rule = await prisma.communityRule.create({
            data: {
                title,
                description: description || "",
                order,
                communityId,
                keywords,
                appliesTo
            }
        });

        return {
            id: rule.id,
            title: rule.title,
            description: rule.description,
            order: rule.order,
            communityId: rule.communityId,
            keywords: rule.keywords,
            appliesTo: rule.appliesTo as "POST" | "COMMENT" | "BOTH",
            isActive: rule.isActive,
            createdAt: rule.createdAt.toISOString(),
            updatedAt: rule.updatedAt.toISOString()
        };
    }


    static async editCommunityRule(input: CommunityRuleInput, ruleId: string, userId: string): Promise<CommunityRuleOutput> {
        const {
            title,
            description,
            order,
            communityId,
            keywords = [],
            appliesTo = "POST"
        } = input;

        if (!title || order === undefined) {
            throw new Error("INVALID_INPUT");
        }

        const rule = await prisma.communityRule.findUnique({
            where: { id: ruleId }
        });

        if (!rule) throw new Error("RULE_NOT_FOUND");
        if (rule.communityId !== communityId) throw new Error("NOT_AUTHORIZED");

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

        // Check order collision (exclude current rule)
        if (order !== rule.order) {
            const existingOrder = await prisma.communityRule.findFirst({
                where: {
                    communityId,
                    order,
                    id: { not: ruleId }
                }
            });

            if (existingOrder) {
                throw new Error("RULE_ORDER_ALREADY_EXISTS");
            }
        }

        const updatedRule = await prisma.communityRule.update({
            where: { id: ruleId },
            data: {
                title,
                description: description || "",
                order,
                keywords,
                appliesTo
            }
        });

        return {
            id: updatedRule.id,
            title: updatedRule.title,
            description: updatedRule.description,
            order: updatedRule.order,
            communityId: updatedRule.communityId,
            keywords: updatedRule.keywords,
            appliesTo: updatedRule.appliesTo as "POST" | "COMMENT" | "BOTH",
            isActive: updatedRule.isActive,
            createdAt: updatedRule.createdAt.toISOString(),
            updatedAt: updatedRule.updatedAt.toISOString()
        };
    }

    static async deleteCommunityRule(ruleId: string, userId: string) {
        const rule = await prisma.communityRule.findUnique({
            where: { id: ruleId }
        });

        if (!rule) throw new Error("RULE_NOT_FOUND");

        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: {
                    userId,
                    communityId: rule.communityId
                }
            }
        });

        if (!membership) throw new Error("NOT_A_MEMBER");
        if (membership.role !== "ADMIN" && membership.role !== "MODERATOR") {
            throw new Error("NOT_AUTHORIZED");
        }

        await prisma.communityRule.delete({
            where: { id: ruleId }
        });

        return { success: true };
    }

    static async getCommunityRules(communityId: string): Promise<CommunityRuleOutput[]> {
        const community = await prisma.community.findUnique({
            where: { id: communityId }
        });

        if (!community) throw new Error("COMMUNITY_NOT_FOUND");

        const rules = await prisma.communityRule.findMany({
            where: {
                communityId,
                isActive: true
            },
            orderBy: { order: 'asc' }
        });

        return rules.map(rule => ({
            id: rule.id,
            title: rule.title,
            description: rule.description,
            order: rule.order,
            communityId: rule.communityId,
            keywords: rule.keywords,
            appliesTo: rule.appliesTo as "POST" | "COMMENT" | "BOTH",
            isActive: rule.isActive,
            createdAt: rule.createdAt.toISOString(),
            updatedAt: rule.updatedAt.toISOString()
        }));
    }
    static async toggleMuteStatus(userId: string, communityId: string) {
        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: { userId, communityId }
            }
        });

        if (!membership) throw new Error("NOT_A_MEMBER");

        const updated = await prisma.communityMember.update({
            where: {
                userId_communityId: { userId, communityId }
            },
            data: {
                isMuted: !membership.isMuted
            }
        });

        return {
            success: true,
            isMuted: updated.isMuted,
            message: updated.isMuted ? "Notifications muted" : "Notifications unmuted"
        };
    }
}
