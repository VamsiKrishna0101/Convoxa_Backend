import prisma from '../../config/prisma.js'
import { NotificationService } from '../notification/notification.services.js'
import { getIO } from '../../socket.js'
import { redis } from '../../config/redis.js'
import { GroupInput, GroupOutput, MessageInput, MessageOutput, EditMessage, GroupMessageOutput } from './group.types.js'

export class GroupService {
    static async createGroup(input: GroupInput, userId: string): Promise<GroupOutput> {
        const { name, description, imageUrl } = input
        if (!name.trim()) {
            throw new Error("INVALID_INPUT")
        }

        // Generate a 6-digit numeric invite code
        const generateInviteCode = () => Math.floor(100000 + Math.random() * 900000).toString();
        let inviteCode = generateInviteCode();

        // Ensure uniqueness
        let attempts = 0;
        while (attempts < 5) {
            const existing = await prisma.group.findUnique({ where: { inviteCode } });
            if (!existing) break;
            inviteCode = generateInviteCode();
            attempts++;
        }

        const group = await prisma.group.create({
            data: {
                name,
                description,
                imageUrl: imageUrl || `https://picsum.photos/seed/${name.trim() + Date.now().toString()}/200/200`,
                ownerId: userId,
                inviteCode,
                members: {
                    create: {
                        userId,
                        role: "OWNER"
                    }
                }
            }
        })
        return {
            id: group.id,
            name: group.name,
            description: group.description,
            ownerId: group.ownerId,
            inviteCode: group.inviteCode,
            createdAt: group.createdAt,
            imageUrl: group.imageUrl
        }

    }

    static async joinGroup(groupId: string | undefined, userId: string, inviteCode?: string) {
        let group;
        if (groupId) {
            group = await prisma.group.findUnique({
                where: { id: groupId }
            });
        } else if (inviteCode) {
            group = await prisma.group.findUnique({
                where: { inviteCode }
            });
        }

        if (!group) {
            throw new Error("GROUP_NOT_FOUND")
        }

        const targetGroupId = group.id;

        const membership = await prisma.groupParticipant.findUnique({
            where: {
                groupId_userId: {
                    groupId: targetGroupId,
                    userId
                }
            }
        })
        if (membership) throw new Error("ALREADY_A_MEMBER")

        await prisma.groupParticipant.create({
            data: {
                userId,
                groupId: targetGroupId
            }
        })

        return {
            success: true,
            group: {
                id: group.id,
                name: group.name,
                imageUrl: group.imageUrl
            }
        }
    }


    static async sendMessage(input: MessageInput, userId: string): Promise<MessageOutput> {
        const { groupId, content, type = "TEXT", mediaUrl } = input

        if (type === "TEXT" && (!content || !content.trim())) {
            throw new Error("CONTENT_REQUIRED")
        }

        const membership = await prisma.groupParticipant.findUnique({
            where: {
                groupId_userId: {
                    groupId,
                    userId
                }
            }
        })
        if (!membership) throw new Error("NOT_A_MEMBER")

        const message = await prisma.groupMessage.create({
            data: {
                groupId,
                senderId: userId,
                content: content || "",
                type: type as any,
                mediaUrl
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        })

        const msg = message as any;
        const messageOutput = {
            id: msg.id,
            groupId: msg.groupId,
            content: msg.content,
            senderId: msg.senderId,
            type: msg.type,
            mediaUrl: msg.mediaUrl,
            createdAt: msg.createdAt.toISOString(),
            sender: msg.sender
        }

        // Redis Cache
        try {
            const cacheKey = `group:${groupId}:messages`;
            await redis.lpush(cacheKey, JSON.stringify(messageOutput));
            await redis.ltrim(cacheKey, 0, 49);
            await redis.expire(cacheKey, 86400);
        } catch (err) {
            // console.error("Redis cache error", err); 
        }

        try {
            getIO().to(groupId).emit("receive_group_message", messageOutput)

            // Notify offline members
            const groupMembers = await prisma.groupParticipant.findMany({
                where: {
                    groupId,
                    userId: { not: userId }
                },
                select: { userId: true, isMuted: true } // Include isMuted
            })

            const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });

            for (const member of groupMembers) {
                if (member.isMuted) continue; // Skip if muted

                const isOnline = await NotificationService.isUserOnline(member.userId);
                if (!isOnline) {
                    const truncatedContent = messageOutput.content.length > 100
                        ? messageOutput.content.substring(0, 100) + "..."
                        : messageOutput.content;

                    await NotificationService.sendPushNotification(
                        member.userId,
                        `${messageOutput.sender.username} in ${group?.name || 'Group'}`,
                        truncatedContent,
                        { groupId, type: "NEW_GROUP_MESSAGE", senderId: messageOutput.senderId }
                    );
                }
            }

        } catch (error) {
            // console.error("Socket emission/Notification failed", error)
        }

        return messageOutput;
    }

    static async markAsRead(groupId: string, userId: string) {
        // Optimization: Just update the pointer to the latest message
        const latestMessage = await prisma.groupMessage.findFirst({
            where: { groupId },
            orderBy: { createdAt: 'desc' },
            select: { id: true }
        });

        if (!latestMessage) return { success: true };

        // Update participant's read pointer
        await prisma.groupParticipant.update({
            where: {
                groupId_userId: {
                    groupId,
                    userId
                }
            },
            data: {
                lastReadMessageId: latestMessage.id,
                lastReadAt: new Date()
            }
        });

        // Emit read event
        try {
            getIO().to(groupId).emit("group_messages_read", {
                groupId,
                userId,
                lastReadMessageId: latestMessage.id
            })
        } catch (error) {
            // console.error("Socket emission failed", error)
        }

        return { success: true }
    }

    static async editMessage(input: EditMessage, userId: string) {
        const { messageId, content } = input
        if (!content.trim()) {
            throw new Error("CONTENT_REQUIRED")
        }
        const message = await prisma.groupMessage.findUnique({
            where: {
                id: messageId
            }
        })
        if (!message) throw new Error("NO_MESSAGE_FOUND")
        if (message.senderId !== userId) throw new Error("NOT_AUTHORIZED")
        const updatedMessage = await prisma.groupMessage.update({
            where: {
                id: messageId
            },
            data: {
                content
            }
        })
        // Fetch to get full fields if needed, or just return basic
        // Invalidate Cache
        try {
            await redis.del(`group:${message.groupId}:messages`);
        } catch (e) { }

        const msg = updatedMessage as any;
        return {
            id: msg.id,
            groupId: msg.groupId,
            content: msg.content,
            senderId: msg.senderId,
            type: msg.type,
            mediaUrl: msg.mediaUrl,
            createdAt: msg.createdAt.toISOString()
        }
    }

    static async deleteMessage(messageId: string, userId: string) {
        const message = await prisma.groupMessage.findUnique({
            where: {
                id: messageId
            }
        })
        if (!message) throw new Error("MESSAGE_NOT_FOUND")
        // Allow owner/admin? For now, only sender
        if (message.senderId !== userId) throw new Error("NOT_AUTHORIZED")

        // Soft Delete
        await prisma.groupMessage.update({
            where: { id: messageId },
            data: {
                isDeleted: true,
                content: "This message was deleted",
                mediaUrl: null
            }
        })

        // Invalidate Cache
        try {
            await redis.del(`group:${message.groupId}:messages`);
        } catch (e) { }

        return { success: true }
    }

    static async getGroupDetails(groupId: string, userId: string): Promise<GroupOutput> {
        const membership = await prisma.groupParticipant.findUnique({
            where: { groupId_userId: { groupId, userId } }
        });
        if (!membership) throw new Error("NOT_A_MEMBER");

        const group = await prisma.group.findUnique({
            where: { id: groupId }
        });
        if (!group) throw new Error("GROUP_NOT_FOUND");

        return {
            id: group.id,
            name: group.name,
            description: group.description,
            imageUrl: group.imageUrl,
            inviteCode: group.inviteCode,
            ownerId: group.ownerId,
            createdAt: group.createdAt
        };
    }

    static async getGroupMessages(groupId: string, userId: string, cursor?: string, limit: number = 20) {
        const membership = await prisma.groupParticipant.findUnique({
            where: {
                groupId_userId: {
                    groupId,
                    userId
                }
            },
            select: {
                isMuted: true
            }
        })
        if (!membership) throw new Error("NOT_A_MEMBER")

        const cacheKey = `group: ${groupId}: messages`;

        // Redis Check (only for first page)
        if (!cursor) {
            try {
                const cached = await redis.lrange(cacheKey, 0, limit - 1);
                if (cached && cached.length > 0) {
                    const messages = cached.map(s => JSON.parse(s));
                    let nextCursor = undefined;
                    // Check if there might be more
                    if (messages.length === limit) {
                        const oneMore = await redis.lindex(cacheKey, limit);
                        if (oneMore) {
                            nextCursor = messages[messages.length - 1].id;
                        } else {
                            nextCursor = messages[messages.length - 1].id;
                        }
                    }
                    return { messages, nextCursor, isMuted: membership.isMuted }
                }
            } catch (e) { }
        }

        const fetchLimit = (!cursor) ? Math.max(limit + 1, 50) : limit + 1;

        const messages = await prisma.groupMessage.findMany({
            where: {
                groupId,
                isDeleted: false
            },
            take: fetchLimit,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        // Populate Cache if first page
        if (!cursor && messages.length > 0) {
            try {
                await redis.del(cacheKey);
                const pipeline = redis.pipeline();
                const toCache = messages.slice(0, 50);
                toCache.forEach(msg => {
                    const m = msg as any;
                    const output = {
                        id: m.id,
                        groupId: m.groupId,
                        content: m.content,
                        senderId: m.senderId,
                        type: m.type,
                        mediaUrl: m.mediaUrl,
                        createdAt: m.createdAt.toISOString(),
                        sender: m.sender
                    };
                    pipeline.rpush(cacheKey, JSON.stringify(output));
                });
                pipeline.expire(cacheKey, 86400);
                await pipeline.exec();
            } catch (e) { }
        }

        let nextCursor: string | undefined = undefined;
        let returnMessages = messages;

        if (messages.length > limit) {
            nextCursor = messages[limit - 1].id;
            returnMessages = messages.slice(0, limit);
        }

        return {
            messages: returnMessages.map(msg => {
                const m = msg as any;
                return {
                    id: m.id,
                    groupId: m.groupId,
                    senderId: m.senderId,
                    content: m.content,
                    type: m.type,
                    mediaUrl: m.mediaUrl,
                    createdAt: m.createdAt.toISOString(),
                    sender: m.sender
                }
            }),
            nextCursor,
            isMuted: membership.isMuted
        }
    }

    static async getMyGroups(userId: string): Promise<GroupOutput[]> {
        const memberships = await prisma.groupParticipant.findMany({
            where: { userId },
            include: {
                group: {
                    include: {
                        messages: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            where: { isDeleted: false },
                            include: {
                                sender: {
                                    select: {
                                        id: true,
                                        username: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const groupsWithCounts = await Promise.all(memberships.map(async (m) => {
            const group = m.group;
            const lastMessageRaw = group.messages[0];

            let unreadCount = 0;
            if (m.lastReadAt) {
                unreadCount = await prisma.groupMessage.count({
                    where: {
                        groupId: group.id,
                        createdAt: { gt: m.lastReadAt },
                        isDeleted: false
                    }
                });
            } else {
                // If never read, count all messages
                unreadCount = await prisma.groupMessage.count({
                    where: {
                        groupId: group.id,
                        isDeleted: false
                    }
                });
            }

            const lastMessage: GroupMessageOutput | null = lastMessageRaw ? {
                id: lastMessageRaw.id,
                groupId: lastMessageRaw.groupId,
                senderId: lastMessageRaw.senderId,
                content: lastMessageRaw.content,
                type: lastMessageRaw.type as any,
                mediaUrl: lastMessageRaw.mediaUrl,
                createdAt: lastMessageRaw.createdAt.toISOString(),
                sender: lastMessageRaw.sender
            } : null;

            return {
                id: group.id,
                name: group.name,
                description: group.description,
                imageUrl: group.imageUrl,
                inviteCode: group.inviteCode,
                ownerId: group.ownerId,
                createdAt: group.createdAt,
                lastMessage,
                unreadCount
            };
        }));

        // Sort by last message date
        return groupsWithCounts.sort((a, b) => {
            const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
            const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
            return timeB - timeA;
        });
    }
    static async toggleMute(groupId: string, userId: string, isMuted: boolean) {
        const membership = await prisma.groupParticipant.findUnique({
            where: { groupId_userId: { groupId, userId } }
        });
        if (!membership) throw new Error("NOT_A_MEMBER");

        await prisma.groupParticipant.update({
            where: { groupId_userId: { groupId, userId } },
            data: { isMuted } as any
        });

        return { success: true, isMuted };
    }

    static async leaveGroup(groupId: string, userId: string) {
        const membership = await prisma.groupParticipant.findUnique({
            where: { groupId_userId: { groupId, userId } }
        });
        if (!membership) throw new Error("NOT_A_MEMBER");

        // Check if owner is leaving
        if (membership.role === "OWNER") {
            // Optional: Prevent owner from leaving without transferring ownership?
            // For now, let's allow it, but warn or just delete the group if last member?
            // Simple logic: Just delete the participant.
        }

        await prisma.groupParticipant.delete({
            where: { groupId_userId: { groupId, userId } }
        });

        // Emit event to group that user left
        try {
            // Retrieve user details for the message
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });

            // Optional: System message that user left?
            // For now just remove them from the list implies they left.
        } catch (e) { }

        return { success: true };
    }
}