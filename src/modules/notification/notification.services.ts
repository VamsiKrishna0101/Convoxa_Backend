import prisma from "../../config/prisma.js";
import { NotificationStatus, NotificationType } from "@prisma/client";
import { getFirebaseApp } from "../../config/firebase.js";
import admin from 'firebase-admin';
import { Expo } from 'expo-server-sdk';
import { getIO } from "../../socket.js";

// Initialize Expo SDK
const expo = new Expo();
export interface NotificationCreateInput {
    content: string;
    type: NotificationType;
    receiverId: string;
    senderId?: string;
    threadId?: string;
    commentId?: string;
    replyId?: string;
    status?: NotificationStatus;
    customThrottleMinutes?: number;
}

export class NotificationService {

    static async isUserOnline(userId: string): Promise<boolean> {
        try {
            const sockets = await getIO().in(`user:${userId}`).fetchSockets();
            return sockets.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * ✅ SEND PUSH NOTIFICATION USING EXPO PUSH SERVICE
     */
    static async sendPushNotification(
        userId: string,
        title: string,
        body: string,
        data?: any,
        imageUrl?: string
    ) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { expopushtoken: true } as any
            });

            const pushToken = (user as any)?.expopushtoken;
            if (!pushToken) {
                return;
            }

            // CASE 1: EXPO PUSH TOKEN
            if (Expo.isExpoPushToken(pushToken)) {
                const messages = [{
                    to: pushToken,
                    sound: 'default' as const,
                    title,
                    body,
                    data: data || {},
                    priority: 'high' as const,
                    channelId: 'default',
                    // Expo supports imageUrl via data or attachments, but for simple display:
                    ...(imageUrl ? { _displayInForeground: true, _contentAvailable: true } : {})
                }];

                try {
                    const ticketChunk = await expo.sendPushNotificationsAsync(messages);
                    // console.log("Expo Push Ticket:", ticketChunk);
                } catch (error) {
                    // console.error("Error sending Expo Push:", error);
                }
                return;
            }

            // CASE 2: FIREBASE / OTHER (FALLBACK)
            // FCM data payload MUST be [key: string]: string
            const stringData: { [key: string]: string } = {};
            if (data) {
                Object.keys(data).forEach(key => {
                    if (data[key] !== undefined && data[key] !== null) {
                        stringData[key] = String(data[key]);
                    }
                });
            }

            const message: admin.messaging.Message = {
                token: pushToken,
                notification: {
                    title,
                    body,
                    imageUrl: imageUrl || undefined
                },
                data: stringData,
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'default',
                        imageUrl: imageUrl || undefined, // Displayed as Big Picture on Android
                        color: '#82C8E5' // Brand Color (BLUESKY)
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            'mutable-content': 1
                        }
                    },
                    fcmOptions: imageUrl ? {
                        imageUrl
                    } : undefined
                }
            };

            const app = getFirebaseApp();
            if (!app) return;

            await app.messaging().send(message);
        } catch (error) {
            // console.error("Failed to send push notification:", error);
        }
    }

    /**
     * CREATE NOTIFICATION ENTRY
     */
    static async createNotification(data: NotificationCreateInput) {

        if (data.senderId && data.receiverId && data.senderId === data.receiverId) {
            return null;
        }

        try {
            const notification = await prisma.notification.create({
                data: {
                    content: data.content,
                    type: data.type,
                    status: "UNREAD",
                    recipientId: data.receiverId,
                    senderId: data.senderId,
                    threadId: data.threadId,
                    commentId: data.commentId,
                    replyId: data.replyId
                }
            });

            try {
                getIO().to(data.receiverId).emit("notification", notification);
            } catch { }

            return notification;

        } catch {
            return null;
        }
    }

    static async getUserNotifications(userId: string, limit: number = 20, cursor?: string) {

        const notifications = await prisma.notification.findMany({
            where: { recipientId: userId },
            include: {
                sender: { select: { id: true, username: true } },
                thread: {
                    select: { id: true, title: true, imageUrl: true, community: { select: { imageUrl: true } } }
                },
                comment: {
                    select: {
                        id: true,
                        content: true,
                        thread: { select: { id: true, title: true, imageUrl: true, community: { select: { imageUrl: true } } } }
                    }
                },
                reply: {
                    select: {
                        id: true,
                        content: true,
                        comment: {
                            select: {
                                thread: { select: { id: true, title: true, imageUrl: true, community: { select: { imageUrl: true } } } }
                            }
                        }
                    }
                }
            },
            take: limit,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { createdAt: "desc" }
        });

        let nextCursor: string | null = null;
        if (notifications.length > 0) {
            nextCursor = notifications[notifications.length - 1].id;
        }

        const enriched = notifications.map((n: any) => {
            let threadName = n.thread?.title;
            let threadId = n.thread?.id;
            let threadImageUrl = n.thread?.imageUrl;
            let communityImageUrl = n.thread?.community?.imageUrl;

            if (!threadName && n.comment?.thread) {
                threadName = n.comment.thread.title;
                threadId = n.comment.thread.id;
                threadImageUrl = n.comment.thread.imageUrl;
                communityImageUrl = n.comment.thread.community?.imageUrl;
            }

            if (!threadName && n.reply?.comment?.thread) {
                threadName = n.reply.comment.thread.title;
                threadId = n.reply.comment.thread.id;
                threadImageUrl = n.reply.comment.thread.imageUrl;
                communityImageUrl = n.reply.comment.thread.community?.imageUrl;
            }

            return {
                id: n.id,
                content: n.content,
                type: n.type,
                status: n.status,
                createdAt: n.createdAt,
                sender: n.sender ? {
                    id: n.sender.id,
                    username: n.sender.username
                } : null,
                threadId: threadId || null,
                threadName: threadName || null,
                threadImageUrl: threadImageUrl || null,
                communityImageUrl: communityImageUrl || null,
                commentId: n.comment?.id || null,
                replyId: n.reply?.id || null
            };
        });

        return { notifications: enriched, nextCursor };
    }

    static async getUnreadCount(userId: string) {
        return prisma.notification.count({
            where: { recipientId: userId, status: "UNREAD" }
        });
    }

    static async markAsRead(userId: string, notificationId?: string) {
        if (notificationId) {
            return prisma.notification.update({
                where: { id: notificationId, recipientId: userId },
                data: { status: "READ" }
            });
        } else {
            return prisma.notification.updateMany({
                where: { recipientId: userId, status: "UNREAD" },
                data: { status: "READ" }
            });
        }
    }

    static async updateFcmToken(userId: string, expopushtoken: string) {
        return prisma.user.update({
            where: { id: userId },
            data: { expopushtoken } as any
        });
    }

    static async toggleCommunityMute(userId: string, communityId: string, isMuted: boolean) {
        return prisma.communityMember.update({
            where: { userId_communityId: { userId, communityId } },
            data: { isMuted } as any
        });
    }

    static async deleteNotification(userId: string, notificationId: string) {
        return prisma.notification.delete({
            where: { id: notificationId, recipientId: userId }
        });
    }
}
