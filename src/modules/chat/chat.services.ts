import { ConversationInput, MessageInput, MessageOutput, DeleteMessageInput, EditMessageInput } from "./chat.types.js";
import prisma from "../../config/prisma.js";
import { ConversationStatus } from "@prisma/client";
import { getIO } from "../../socket.js";
import { redis } from "../../config/redis.js";
import { NotificationService } from "../notification/notification.services.js";


export class ChatService {

    static async createConversation(input: ConversationInput, userId: string) {
        const { targetUserId } = input
        // console.log(targetUserId)
        // console.log(userId)
        if (!targetUserId || targetUserId === userId) {
            throw new Error("INVALID_TARGET_USER")
        }
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId }
        })
        if (!targetUser) {
            throw new Error("TARGET_NOT_FOUND")
        }
        const existingchat = await prisma.conversation.findFirst({
            where: {
                participants: {
                    every: {
                        userId: { in: [userId, targetUserId] }
                    }
                }
            }
        })

        if (existingchat?.status === "WITHDRAWN" && existingchat.withdrawnAt) {
            const daysSinceWithdrawal = (new Date().getTime() - new Date(existingchat.withdrawnAt).getTime()) / (1000 * 3600 * 24);
            if (daysSinceWithdrawal < 3) {
                throw new Error("WITHDRAWAL_COOLDOWN");
            }
            // If cooldown passed, we can reset this conversation or create a new one. 
            // Better to update the existing one to PENDING.
            const updated = await prisma.conversation.update({
                where: { id: existingchat.id },
                data: {
                    status: "PENDING",
                    initiatorId: userId,
                    recipientId: targetUserId,
                    createdAt: new Date(), // bumping created at to show as new request
                    updatedAt: new Date(),
                    withdrawnAt: null // clear withdrawal
                }
            });
            return {
                ...updated,
                conversationId: updated.id
            }
        }

        let conversation;
        if (existingchat) {
            conversation = existingchat;
        } else {
            conversation = await prisma.conversation.create({
                data: {
                    initiatorId: userId,
                    recipientId: targetUserId,
                    status: "PENDING",
                    participants: {
                        createMany: {
                            data: [
                                { userId },
                                { userId: targetUserId }
                            ]
                        }
                    }
                }
            })
        }

        return {
            ...conversation,
            conversationId: conversation.id
        }
    }

    static async withdrawRequest(conversationId: string, userId: string) {
        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

        if (conversation.initiatorId !== userId) throw new Error("ONLY_INITIATOR_CAN_WITHDRAW");
        if (conversation.status !== "PENDING") throw new Error("CAN_ONLY_WITHDRAW_PENDING");

        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                status: "WITHDRAWN",
                withdrawnAt: new Date()
            }
        });
        return { success: true };
    }

    static async sendMessage(input: MessageInput, senderId: string): Promise<MessageOutput> {
        let { content, conversationId, targetUserId, type = "TEXT", mediaUrl, tempId } = input

        // If no conversationId, try to find or create using targetUserId
        if (!conversationId) {
            throw new Error("CONVERSATION_ID_REQUIRED");
        }

        if (type === "TEXT" && (!content || content.trim().length === 0) && !mediaUrl) {
            throw new Error("CONTENT_REQUIRED")
        }

        // Implicitly mark as read for the sender (since they are looking at it to send)
        await ChatService.markAsRead(conversationId, senderId);

        const membership = await prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: conversationId!, // Assert non-null
                    userId: senderId
                }
            },
        })
        if (!membership) throw new Error("NOT_A_PARTICIPANT")

        const message = await prisma.message.create({
            data: {
                content: content || "",
                conversationId: conversationId!, // Assert non-null
                senderId,
                type: type as any,
                mediaUrl,
                isViewOnce: input.isViewOnce || false,
                status: "SENT" as any
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        avatarConfig: true
                    }
                }
            }
        })

        const msg = message as any;
        const messageOutput = {
            id: msg.id,
            content: msg.content,
            senderId: msg.senderId,
            conversationId: msg.conversationId,
            type: msg.type,
            mediaUrl: msg.mediaUrl,
            isViewOnce: msg.isViewOnce,
            status: msg.status,
            createdAt: msg.createdAt.toISOString(),
            sender: msg.sender,
            tempId: tempId // Return tempId so frontend knows which optimistic msg to replace
        }

        // Update Conversation updatedAt
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        });

        // Redis Cache
        try {
            const cacheKey = `chat:${conversationId}:messages`;
            await redis.lpush(cacheKey, JSON.stringify(messageOutput));
            await redis.ltrim(cacheKey, 0, 49);
            await redis.expire(cacheKey, 86400); // 24h
        } catch (err) {
            // console.error("Redis cache error", err); 
        }

        try {
            getIO().to(conversationId!).emit("receive_message", messageOutput);

            // Parallelize Push Notifications for offline participants
            const participants = await prisma.conversationParticipant.findMany({
                where: {
                    conversationId,
                    userId: { not: senderId }
                },
                select: { userId: true, isMuted: true } as any // Include isMuted
            });

            await Promise.all(participants.map(async (p) => {
                if (p.isMuted) return;

                const isOnline = await NotificationService.isUserOnline(p.userId);
                if (!isOnline) {
                    const truncatedContent = messageOutput.content.length > 100
                        ? messageOutput.content.substring(0, 100) + "..."
                        : messageOutput.content;

                    const notificationImage = messageOutput.mediaUrl || undefined;

                    await NotificationService.sendPushNotification(
                        p.userId,
                        messageOutput.sender.username, // Title: Sender Name
                        truncatedContent, // Body: Message Content
                        { conversationId, type: "NEW_MESSAGE", senderId: messageOutput.senderId },
                        notificationImage
                    ).catch(err => {
                        // console.error("Push failed for user", p.userId, err);
                    });
                }
            }));

            // Update Conversation updatedAt
            await prisma.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() }
            });
        } catch (error) {
            // console.error("Socket emission/Push/DB update failed:", error);
        }

        return messageOutput;
    }

    static async markAsRead(conversationId: string, userId: string) {
        // Update all unread messages in this conversation sent by OTHER users
        await prisma.message.updateMany({
            where: {
                conversationId,
                senderId: { not: userId },
                status: { not: "READ" as any }
            },
            data: {
                status: "READ" as any
            }
        })

        // Emit read receipt
        try {
            getIO().to(conversationId).emit("messages_read", { conversationId, readByUserId: userId });
        } catch (error) {
            // console.error("Socket emission failed:", error);
        }

        return { success: true }
    }

    static async markMessageViewed(messageId: string, userId: string) {
        const message = await prisma.message.findUnique({
            where: { id: messageId }
        });
        if (!message) throw new Error("MESSAGE_NOT_FOUND");
        if (message.senderId === userId) return;

        const membership = await prisma.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId: message.conversationId, userId } }
        });
        if (!membership) throw new Error("NOT_A_PARTICIPANT");

        await prisma.message.update({
            where: { id: messageId },
            data: { isViewed: true }
        });

        await redis.del(`chat:${message.conversationId}:messages`);
    }

    static async deleteMessage(input: DeleteMessageInput, senderId: string) {
        const { messageId, conversationId } = input
        const membership = await prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId: senderId
                }
            }
        })
        if (!membership) throw new Error("NOT_A_PARTICIPANT")

        const message = await prisma.message.findUnique({
            where: { id: messageId }
        })

        if (!message) throw new Error("MESSAGE_NOT_FOUND")
        if (message.senderId !== senderId) throw new Error("NOT_THE_AUTHOR")

        // Soft Delete
        await prisma.message.update({
            where: { id: messageId },
            data: {
                isDeleted: true,
                content: "This message was deleted",
                mediaUrl: null
            }
        })

        // Invalidate Cache
        try {
            await redis.del(`chat:${conversationId}:messages`);
        } catch (e) { }

        return { success: true }
    }

    static async getMessages(conversationId: string, userId: string, cursor?: string, limit: number = 20) {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId }
        })
        if (!conversation) throw new Error("CONVERSATION_NOT_FOUND")

        const membership = await prisma.conversationParticipant.findUnique({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId
                }
            },
            select: {
                isMuted: true
            }
        })
        if (!membership) throw new Error("NOT_A_PARTICIPANT")

        const isMuted = membership.isMuted;
        const cacheKey = `chat:${conversationId}:messages`;

        // Redis Check (only for first page)
        if (!cursor) {
            try {
                const cached = await redis.lrange(cacheKey, 0, limit - 1);
                if (cached && cached.length > 0) {
                    const messages = cached.map(s => {
                        const msg = JSON.parse(s);
                        const canView = msg.isViewOnce && !msg.isViewed && msg.senderId !== userId;
                        return { ...msg, mediaUrl: (msg.isViewOnce && !canView) ? null : msg.mediaUrl };
                    });
                    let nextCursor = undefined;

                    if (messages.length === limit) {
                        const oneMore = await redis.lindex(cacheKey, limit);
                        if (oneMore) {
                            nextCursor = messages[messages.length - 1].id;
                        }
                    }

                    return { messages, nextCursor, isMuted }
                }
            } catch (e) {
                // console.error("Redis read error", e); 
            }
        }

        const messages = await prisma.message.findMany({
            where: {
                conversationId,
                isDeleted: false
            },
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        avatarConfig: true
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
                // Push all fetched messages (up to 50 for cache safety)
                const pipeline = redis.pipeline();

                messages.forEach(msg => {
                    const m = msg as any;
                    const output = {
                        id: m.id,
                        content: m.content,
                        senderId: m.senderId,
                        conversationId: m.conversationId,
                        type: m.type,
                        mediaUrl: m.mediaUrl,
                        status: m.status,
                        isViewOnce: m.isViewOnce,
                        isViewed: m.isViewed,
                        createdAt: m.createdAt.toISOString(),
                        sender: m.sender
                    };
                    pipeline.rpush(cacheKey, JSON.stringify(output));
                });
                pipeline.expire(cacheKey, 86400);
                await pipeline.exec();
            } catch (e) {
                // console.error("Redis populate error", e); 
            }
        }

        let returnMessages = messages;
        let nextCursor: string | undefined = undefined;

        if (messages.length > limit) {
            returnMessages = messages.slice(0, limit);
            const nextItem = returnMessages[returnMessages.length - 1];
            nextCursor = nextItem?.id;
        }

        const filteredMessages = returnMessages.map(msg => {
            const m = msg as any;
            const canView = m.isViewOnce && !m.isViewed && m.senderId !== userId;
            return {
                ...msg,
                mediaUrl: (m.isViewOnce && !canView) ? null : m.mediaUrl
            };
        });

        return { messages: filteredMessages, nextCursor, isMuted };
    }

    static async getChatList(userId: string, cursor?: string, limit: number = 20) {
        // Now using updatedAt for "Most Recent Activity"
        const conversations = await prisma.conversation.findMany({
            where: {
                AND: [
                    { participants: { some: { userId } } },
                    { OR: [{ status: "ACCEPTED" }, { status: "PENDING", initiatorId: userId }] }
                ]
            },
            take: limit + 1,
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            include: {
                participants: {
                    where: { userId: { not: userId } },
                    include: { user: { select: { id: true, username: true, avatarConfig: true } } }
                },
                messages: {
                    take: 1,
                    orderBy: { createdAt: "desc" }
                },
                _count: {
                    select: {
                        messages: {
                            where: {
                                senderId: { not: userId },
                                status: { not: "READ" as any }
                            }
                        }
                    }
                }
            },
            orderBy: [
                { updatedAt: "desc" },
                { id: "desc" }
            ]
        });

        let nextCursor: string | undefined = undefined;
        if (conversations.length > limit) {
            const nextItem = conversations.pop();
            nextCursor = nextItem?.id;
        }

        return {
            conversations: (conversations as any[]).map(conv => {
                const otherUser = conv.participants[0]?.user;
                const lastMessage = conv.messages[0];

                return {
                    conversationId: conv.id,
                    user: otherUser,
                    lastMessage: lastMessage
                        ? {
                            content: lastMessage.content,
                            createdAt: lastMessage.createdAt,
                            mediaUrl: lastMessage.mediaUrl
                        }
                        : null,
                    unreadCount: conv._count?.messages || 0,
                    updatedAt: conv.updatedAt
                };
            }),
            nextCursor
        };
    }

    static async getTotalUnreadCount(userId: string) {
        const count = await prisma.message.count({
            where: {
                senderId: { not: userId },
                status: { not: "READ" as any },
                conversation: {
                    participants: {
                        some: { userId }
                    }
                }
            }
        });
        return count;
    }

    static async editMessage(input: EditMessageInput, userId: string) {
        const { messageId, conversationId, content } = input;
        if (!content || content.trim().length === 0) {
            throw new Error("CONTENT_REQUIRED")
        }

        const existingMessage = await prisma.message.findUnique({
            where: {
                id: messageId,
                conversationId
            }
        })

        if (!existingMessage) throw new Error("MESSAGE_NOT_FOUND")
        if (existingMessage.senderId !== userId) throw new Error("NOT_THE_AUTHOR")

        const updatedMessage = await prisma.message.update({
            where: {
                id: messageId
            },
            data: {
                content
            }
        })

        // Invalidate Cache
        try {
            await redis.del(`chat:${conversationId}:messages`);
        } catch (e) { }

        const msg = updatedMessage as any;
        return {
            id: msg.id,
            content: msg.content,
            senderId: msg.senderId,
            conversationId: msg.conversationId,
            type: msg.type,
            mediaUrl: msg.mediaUrl,
            status: msg.status,
            createdAt: msg.createdAt.toISOString()
        }
    }


    static async acceptChat(conversationId: string, userId: string) {
        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

        // Only non-initiator (recipient) can accept
        if (conversation.initiatorId === userId) throw new Error("CANNOT_ACCEPT_OWN_REQUEST");

        if (conversation.status !== "PENDING" && conversation.status !== "REJECTED") {
            return { success: true, status: conversation.status }; // Already accepted
        }

        const updated = await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                status: "ACCEPTED",
                acceptedAt: new Date(),
                acceptedBy: userId
            },
            include: {
                initiator: { select: { username: true } },
                recipient: { select: { username: true } }
            }
        });

        // Trigger Notification for the Initiator
        try {
            await NotificationService.createNotification({
                receiverId: conversation.initiatorId!,
                senderId: userId,
                content: `${updated.recipient?.username} accepted your chat request!`,
                type: "CHAT_ACCEPTED" as any // Use as any if types not reloaded yet
            });

            // Also send Push Notification
            await NotificationService.sendPushNotification(
                conversation.initiatorId!,
                "Chat Request Accepted",
                `${updated.recipient?.username} accepted your chat request!`,
                { conversationId, type: "CHAT_ACCEPTED" }
            );
        } catch (err) {
            // console.error("Failed to send chat acceptance notification:", err);
        }

        return updated;
    }

    static async rejectChat(conversationId: string, userId: string) {
        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

        // Recipient can reject. Initiator can technically "cancel" via delete, but let's allow reject too?
        // Usually primarily recipient.

        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                status: "REJECTED"
            }
        });
        return { success: true };
    }

    static async blockChat(conversationId: string, userId: string) {
        // Any participant can block
        const membership = await prisma.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId, userId } }
        })
        if (!membership) throw new Error("NOT_A_PARTICIPANT");

        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                status: "BLOCKED",
                blockedBy: userId,
                blockedAt: new Date()
            }
        });
        return { success: true };
    }

    static async unblockChat(conversationId: string, userId: string) {
        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

        if (conversation.blockedBy !== userId) {
            throw new Error("ONLY_BLOCKER_CAN_UNBLOCK");
        }

        // Reset to ACCEPTED (assuming if unblocked you want to chat)
        // Or back to previous state? ACCEPTED is safest assumption for "allowed".
        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                status: "ACCEPTED",
                blockedBy: null,
                blockedAt: null
            }
        });
        return { success: true };
    }

    static async getMyRequests(userId: string, cursor?: string, limit: number = 20) {
        try {
            const myRequests = await prisma.conversation.findMany({
                where: {
                    recipientId: userId,
                    status: "PENDING"
                },
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: { createdAt: 'desc' },
                include: {
                    initiator: {
                        select: {
                            id: true,
                            username: true,
                            avatarConfig: true
                        }
                    }
                }
            })

            let nextCursor: string | undefined = undefined;
            if (myRequests.length > limit) {
                const nextItem = myRequests.pop();
                nextCursor = nextItem?.id;
            }

            return {
                requests: myRequests.map(request => ({
                    conversationId: request.id,
                    ...request
                })),
                nextCursor
            };
        } catch (error) {
            throw error
        }
    }

    static async getBlockedChats(userId: string, cursor?: string, limit: number = 20) {
        try {
            const blockedChats = await prisma.conversation.findMany({
                where: {
                    status: "BLOCKED",
                    blockedBy: userId
                },
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                skip: cursor ? 1 : 0,
                orderBy: { blockedAt: 'desc' }, // Order by when they were blocked
                include: {
                    participants: {
                        where: { userId: { not: userId } },
                        include: { user: { select: { id: true, username: true, avatarConfig: true } } }
                    }
                }
            });

            let nextCursor: string | undefined = undefined;
            if (blockedChats.length > limit) {
                const nextItem = blockedChats.pop();
                nextCursor = nextItem?.id;
            }

            return {
                conversations: blockedChats.map(conv => ({
                    conversationId: conv.id,
                    user: conv.participants[0]?.user,
                    blockedAt: conv.blockedAt
                })),
                nextCursor
            };
        } catch (error) {
            throw error;
        }
    }

    static async toggleMute(conversationId: string, userId: string, isMuted: boolean) {
        const membership = await prisma.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId, userId } }
        });
        if (!membership) throw new Error("NOT_A_PARTICIPANT");

        await prisma.conversationParticipant.update({
            where: { conversationId_userId: { conversationId, userId } },
            data: { isMuted } as any
        });

        return { success: true, isMuted };
    }
}
