import prisma from "../../config/prisma.js";
import { ProfileOutput, UserThreadOutput, UserReplyOutput, UserCommunityOutput, UserBasicInfo } from "./profile.types.js";
import { NotificationService } from "../notification/notification.services.js";
import { NotificationType, NotificationStatus } from "@prisma/client";

export class ProfileService {
    static async getProfile(userId: string, viewerId?: string): Promise<ProfileOutput> {
        const [user, threads, comments] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    createdAt: true,
                    avatarConfig: true,
                    _count: {
                        select: {
                            followers: true,
                            following: true,
                            threads: true
                        }
                    }
                }
            }),
            prisma.thread.findMany({
                where: { authorId: userId, isDeleted: false },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    title: true,
                    content: true,
                    upvotes: true,
                    communityId: true,
                    createdAt: true,
                    communityName: true,
                    author: { select: { username: true, avatarConfig: true } }
                }
            }),
            prisma.comment.findMany({
                where: { authorId: userId, isDeleted: false },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    content: true,
                    threadId: true,
                    createdAt: true,
                    upvotes: true
                }
            })
        ]);

        if (!user) throw new Error("USER_NOT_FOUND")

        let isFollowingVal: boolean = false;
        let conversationStatusVal: string | undefined = undefined;
        let conversationIdVal: string | undefined = undefined;
        let initiatorIdVal: string | null | undefined = undefined;
        let withdrawnAtVal: Date | null | undefined = undefined;

        if (viewerId && viewerId !== userId) {
            const [fCheckRes, convRes]: [any, any] = await Promise.all([
                prisma.userFollow.findFirst({
                    where: { followerId: viewerId, followingId: userId }
                }),
                prisma.conversation.findFirst({
                    where: {
                        participants: {
                            every: {
                                userId: { in: [viewerId, userId] }
                            }
                        }
                    },
                    select: {
                        id: true,
                        status: true,
                        initiatorId: true,
                        withdrawnAt: true
                    } as any
                })
            ]);
            isFollowingVal = !!fCheckRes;
            if (convRes) {
                conversationStatusVal = convRes.status;
                conversationIdVal = convRes.id;
                initiatorIdVal = convRes.initiatorId;
                withdrawnAtVal = convRes.withdrawnAt;
            }
        }

        return {
            ...user,
            followersCount: user._count.followers,
            followingCount: user._count.following,
            threadsCount: user._count.threads,
            isFollowing: isFollowingVal,
            conversationStatus: conversationStatusVal,
            conversationId: conversationIdVal,
            initiatorId: initiatorIdVal,
            withdrawnAt: withdrawnAtVal,
            threads: threads.map(t => ({ ...t, avatarConfig: t.author?.avatarConfig })),
            comments
        } as any;
    }

    static async getPosts(userId: string, sort: 'asc' | 'desc' = 'desc'): Promise<UserThreadOutput[]> {
        const posts = await prisma.thread.findMany({
            where: {
                authorId: userId
            },
            orderBy: {
                createdAt: sort
            },
            select: {
                id: true,
                title: true,
                content: true,
                upvotes: true,
                communityId: true,
                createdAt: true,
                communityName: true
            }
        })
        return posts
    }

    static async getReplies(userId: string, sort: 'asc' | 'desc' = 'desc'): Promise<UserReplyOutput[]> {
        const replies = await prisma.reply.findMany({
            where: {
                authorId: userId
            },
            orderBy: {
                createdAt: sort
            },
            select: {
                id: true,
                content: true,
                commentId: true,
                createdAt: true
            }
        })
        return replies
    }
    static async getCommunities(userId: string): Promise<UserCommunityOutput[]> {
        const members = await prisma.communityMember.findMany({
            where: {
                userId
            },
            include: {
                community: true
            },
            orderBy: {
                joinedAt: 'desc'
            }
        })

        return members.map(member => ({
            id: member.community.id,
            name: member.community.name,
            description: member.community.description,
            imageUrl: member.community.imageUrl,
            role: member.role,
            joinedAt: member.joinedAt
        }))
    }

    static async getFollowers(userId: string): Promise<UserBasicInfo[]> {
        const followers = await prisma.userFollow.findMany({
            where: {
                followingId: userId
            },
            include: {
                follower: {
                    select: {
                        id: true,
                        username: true,
                        // imageUrl: true // Add this back if User model has imageUrl
                    }
                }
            }
        })
        return followers.map(f => ({
            id: f.follower.id,
            username: f.follower.username
        }))
    }

    static async getFollowing(userId: string): Promise<UserBasicInfo[]> {
        const following = await prisma.userFollow.findMany({
            where: {
                followerId: userId
            },
            include: {
                following: {
                    select: {
                        id: true,
                        username: true,
                        // imageUrl: true
                    }
                }
            }
        })
        return following.map(f => ({
            id: f.following.id,
            username: f.following.username
        }))
    }
    static async followUser(followerId: string, followingId: string) {
        const existingFollow = await prisma.userFollow.findFirst({
            where: {
                followerId,
                followingId
            }
        })
        if (existingFollow) throw new Error("ALREADY_FOLLOWING")
        await prisma.userFollow.create({
            data: {
                followerId,
                followingId
            }
        })

        // Notify User about new follower
        try {
            const follower = await prisma.user.findUnique({
                where: { id: followerId },
                select: { username: true }
            });

            if (follower) {
                await NotificationService.createNotification({
                    content: `${follower.username} started following you`,
                    type: NotificationType.NEW_FOLLOWER,
                    status: NotificationStatus.UNREAD,
                    senderId: followerId,
                    receiverId: followingId,
                });
            }
        } catch (e) {
            // console.error("Failed to notify new follower", e);
        }

        return {
            success: true,
            message: "Followed Successfully"
        }
    }

    static async unfollowUser(followerId: string, followingId: string) {
        const existingfollow = await prisma.userFollow.findFirst({
            where: {
                followerId,
                followingId
            }
        })
        if (!existingfollow) throw new Error("NOT_FOLLOWING")
        await prisma.userFollow.delete({
            where: {
                id: existingfollow.id
            }
        })
        return {
            success: true,
            message: "Unfollowed Successfully"
        }
    }

    static async updateAvatarConfig(userId: string, avatarConfig: object) {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { avatarConfig: avatarConfig as any },
            select: {
                id: true,
                username: true,
                avatarConfig: true
            }
        });
        return updatedUser;
    }

    static async getUpvotedThreads(userId: string, sort: 'asc' | 'desc' = 'desc'): Promise<UserThreadOutput[]> {
        const threads = await prisma.thread.findMany({
            where: {
                votes: {
                    some: {
                        userId: userId,
                        type: 'UP'
                    }
                },
                isDeleted: false
            },
            orderBy: {
                createdAt: sort
            },
            select: {
                id: true,
                title: true,
                content: true,
                communityId: true,
                createdAt: true,
                community: {
                    select: {
                        name: true
                    }
                },
                author: {
                    select: {
                        username: true,
                        avatarConfig: true
                    }
                }
            }
        });

        return threads.map(t => ({
            ...t,
            // If UserThreadOutput doesn't have author field, we might need to update it or just return it as is if it allows extra props (unlikely in strict TS)
            // Let's assume for now we adhere to the existing type or update it. 
            // Existing `getPosts` selects: id, title, content, upvotes, communityId, createdAt, communityName.
            // But upvoted threads are likely from other authors, so displaying author name is important.
            author: t.author // Include author
        })) as any;
    }
}