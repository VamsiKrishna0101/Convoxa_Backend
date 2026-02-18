import { Request, Response } from "express";
import { NotificationService } from "./notification.services";
import { NotificationStatus } from "@prisma/client";

export const getNotifications = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
        const cursor = req.query.cursor as string | undefined;

        const result = await NotificationService.getUserNotifications(userId, limit, cursor);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUnreadCount = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const count = await NotificationService.getUnreadCount(userId);
        return res.status(200).json({ success: true, count });
    } catch (error) {
        console.error("Error fetching unread count:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { notificationId } = req.body; // Optional: if null, mark all

        await NotificationService.markAsRead(userId, notificationId);
        return res.status(200).json({ success: true, message: "Marked as read" });
    } catch (error) {
        console.error("Error marking notifications as read:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const createNotification = async (req: Request, res: Response) => {
    try {
        const senderId = req.user!.userId;
        const { content, type, receiverId, threadId, commentId, replyId } = req.body;

        if (!content || !type || !receiverId) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // status is required by the type, even if service defaults it
        const notification = await NotificationService.createNotification({
            content,
            type,
            status: NotificationStatus.UNREAD,
            receiverId,
            senderId,
            threadId,
            commentId,
            replyId
        });

        if (!notification) {
            return res.status(400).json({ success: false, message: "Notification not created" });
        }

        return res.status(201).json({ success: true, notification });
    } catch (error) {
        console.error("Error creating notification:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
export const updateFcmToken = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { expopushtoken } = req.body;

        if (!expopushtoken) {
            return res.status(400).json({ success: false, message: "Token required" });
        }

        await NotificationService.updateFcmToken(userId, expopushtoken);
        return res.status(200).json({ success: true, message: "FCM token updated" });
    } catch (error) {
        console.error("Error updating FCM token:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const toggleCommunityMute = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { communityId, isMuted } = req.body;

        if (!communityId || isMuted === undefined) {
            return res.status(400).json({ success: false, message: "Community ID and mute status required" });
        }

        await NotificationService.toggleCommunityMute(userId, communityId, isMuted);
        return res.status(200).json({ success: true, message: `Notification setting updated for community ${communityId}` });
    } catch (error) {
        console.error("Error toggling community mute:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
export const deleteNotification = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { notificationId } = req.params;

        if (!notificationId) {
            return res.status(400).json({ success: false, message: "Notification ID required" });
        }

        await NotificationService.deleteNotification(userId, String(notificationId));
        return res.status(200).json({ success: true, message: "Notification deleted" });
    } catch (error: any) {
        console.error("Error deleting notification:", error);
        if (error.message === "NOTIFICATION_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Notification not found or access denied" });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
