import prisma from "../../config/prisma.js";
import { NotificationStatus } from "@prisma/client";
import { getFirebaseApp } from "../../config/firebase.js";
import admin from 'firebase-admin';

import { getIO } from "../../socket.js";

// Assuming NotificationType is defined elsewhere or needs to be imported/defined here.
// For the purpose of this edit, we'll assume it's available or needs to be defined.
// If NotificationType is also from notification.types, it would need to be moved or re-imported.
// For now, let's assume it's a simple string or enum that might be defined in this file or globally.
// If it's an enum from Prisma, it would be @prisma/client.
// Let's add a placeholder for NotificationType if it's not from @prisma/client.
// Based on the context, it's likely an enum like "UPVOTED_THREAD", "NEW_THREAD", etc.
// If it's from @prisma/client, it would be NotificationType.
// Let's assume it's NotificationType from @prisma/client for now, as NotificationStatus is.
import { NotificationType } from "@prisma/client";

export interface NotificationCreateInput {
    content: string;
    type: NotificationType;
    receiverId: string;
    senderId?: string;
    threadId?: string;
    commentId?: string;
    replyId?: string;
    status?: NotificationStatus;
    customThrottleMinutes?: number; // Optional custom throttle
}

export class NotificationService {
    // Check if user is connected to any socket in their private room
    static async isUserOnline(userId: string): Promise<boolean> {
        try {
            const sockets = await getIO().in(`user:${userId}`).fetchSockets();
            return sockets.length > 0;
        } catch (error) {
            // console.error("Error checking online status:", error);
            return false;
        }
    }


    /**
     * Sends a push notification to a specific user
     */
    static async sendPushNotification(userId: string, title: string, body: string, data?: any, imageUrl?: string) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { expopushtoken: true } as any
            });

            if (!(user as any)?.expopushtoken) {
                return;
            }

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
                token: (user as any).expopushtoken,
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
                        // icon: 'ic_notification', // Optional: Custom small icon if resource exists
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
     * Create a new notification
     * Checks if a similar notification exists to avoid spam (e.g., duplicate likes)
     */
    static async createNotification(data: NotificationCreateInput) {
        // Prevent self-notifications
        if (data.senderId && data.receiverId && data.senderId === data.receiverId) {
            return null;
        }

        // Check for duplicates (e.g. upvoting same thread multiple times shouldn't spam, causing unique constraint errors if not handled, though logic usually prevents re-votes)
        // For simple MVP, we just create. 
        // Improvement: If UNREAD notification of same type/thread/sender exists, update createdAt instead of new row? 
        // For now, let's just insert.

        try {
            const notification = await prisma.notification.create({
                data: {
                    content: data.content,
                    type: data.type,
                    status: "UNREAD", // Default
                    recipientId: data.receiverId,
                    senderId: data.senderId,
                    threadId: data.threadId,
                    commentId: data.commentId,
                    replyId: data.replyId
                }
            });

            // Emit Real-time Notification
            try {
                getIO().to(data.receiverId).emit("notification", notification);
            } catch (err) {
                // console.error("Socket emission failed:", err);
            }

            return notification;
        } catch (error) {
            // console.error("Failed to create notification:", error);
            // Don't throw, just return null so main flow isn't interrupted
            return null;
        }
    }

    /**
     * Get notifications for a user
     */
    static async getUserNotifications(userId: string, limit: number = 20, cursor?: string) {

        const notifications = await prisma.notification.findMany({
            where: { recipientId: userId },
            include: {
                sender: {
                    select: { id: true, username: true } // Minimal user info
                },
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
            orderBy: { createdAt: 'desc' }
        });

        // Calculate next cursor
        let nextCursor: string | null = null;
        if (notifications.length > 0) {
            nextCursor = notifications[notifications.length - 1].id;
        }

        // Flatten/Enrich the response
        const enrichedNotifications = notifications.map((n: any) => {
            let threadName = n.thread?.title;
            let threadId = n.thread?.id;
            let threadImageUrl = n.thread?.imageUrl;
            let communityImageUrl = n.thread?.community?.imageUrl;

            // If direct thread is missing, look in comment
            if (!threadName && n.comment?.thread) {
                threadName = n.comment.thread.title;
                threadId = n.comment.thread.id;
                threadImageUrl = n.comment.thread.imageUrl;
                communityImageUrl = n.comment.thread.community?.imageUrl;
            }

            // If still missing, look in reply -> comment -> thread
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
                avatarConfig: (n.sender as any)?.avatarConfig,
                sender: n.sender ? {
                    id: n.sender.id,
                    username: n.sender.username,
                    avatarConfig: (n.sender as any).avatarConfig
                } : null,
                threadId: threadId || null,
                threadName: threadName || null,
                threadImageUrl: threadImageUrl || null,
                communityImageUrl: communityImageUrl || null,
                username: n.sender?.username || null,
                commentId: n.comment?.id || null,
                replyId: n.reply?.id || null,
            };
        });

        return {
            notifications: enrichedNotifications,
            nextCursor
        };
    }


    /**
     * Get unread count
     */
    static async getUnreadCount(userId: string) {
        return await prisma.notification.count({
            where: {
                recipientId: userId,
                status: "UNREAD"
            }
        });
    }

    /**
     * Mark notifications as read
     * If notificationId is provided, mark one. If not, mark all for user.
     */
    static async markAsRead(userId: string, notificationId?: string) {
        if (notificationId) {
            return await prisma.notification.update({
                where: {
                    id: notificationId,
                    recipientId: userId // Security check
                },
                data: { status: "READ" }
            });
        } else {
            // Mark all
            return await prisma.notification.updateMany({
                where: {
                    recipientId: userId,
                    status: "UNREAD"
                },
                data: { status: "READ" }
            });
        }
    }

    /**
     * Update user's FCM token for push notifications
     */
    static async updateFcmToken(userId: string, expopushtoken: string) {
        return await prisma.user.update({
            where: { id: userId },
            data: { expopushtoken } as any
        });
    }

    /**
     * Toggle community mute setting for a user
     */
    static async toggleCommunityMute(userId: string, communityId: string, isMuted: boolean) {
        return await prisma.communityMember.update({
            where: {
                userId_communityId: { userId, communityId }
            },
            data: { isMuted } as any
        });
    }

    static async deleteNotification(userId: string, notificationId: string) {
        return await prisma.notification.delete({
            where: {
                id: notificationId,
                recipientId: userId
            }
        })
    }
}