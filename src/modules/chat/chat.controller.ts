import type { Request, Response } from "express";
import { ChatService } from "./chat.services.js";
import { uploadBufferToGCS, generateSignedReadUrl } from "../../utils/gcp.js";
import type { Request as MulterRequest } from "express";

/**
 * POST /api/chat/upload-image
 * Accepts: multipart/form-data with field "image" (the file buffer)
 * Returns: { success: true, signedUrl: string } — a 1-hour signed read URL
 */
export const uploadChatImage = async (req: MulterRequest & { file?: Express.Multer.File }, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No image file provided" });
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ success: false, message: "Invalid file type" });
        }

        const { bucketName, filePath } = await uploadBufferToGCS(
            req.file.buffer,
            req.file.mimetype,
            "chat"
        );

        // Generate a signed URL valid for 1 hour
        const signedUrl = await generateSignedReadUrl(bucketName, filePath, 60 * 60 * 1000);

        return res.status(200).json({ success: true, signedUrl, filePath });
    } catch (error: any) {
        console.error("Chat image upload error:", error);
        return res.status(500).json({ success: false, message: "Failed to upload image" });
    }
};


export const createConversation = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ChatService.createConversation(req.body, userId);
        return res.status(201).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "INVALID_TARGET_USER") {
            return res.status(400).json({ success: false, message: "Invalid target user" });
        }
        if (error.message === "TARGET_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Target user not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const sendMessage = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ChatService.sendMessage(req.body, userId);
        return res.status(201).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "CONTENT_REQUIRED") {
            return res.status(400).json({ success: false, message: "Message content is required" });
        }
        if (error.message === "NOT_A_PARTICIPANT") {
            return res.status(403).json({ success: false, message: "You are not a participant of this conversation" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteMessage = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ChatService.deleteMessage(req.body, userId);
        return res.status(200).json({ success: true, message: "Message deleted successfully" });
    } catch (error: any) {
        if (error.message === "NOT_A_PARTICIPANT") {
            return res.status(403).json({ success: false, message: "You are not a participant of this conversation" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getConversations = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { cursor, limit } = req.query;
        // Use getChatList as the service method for both endpoints
        const result = await ChatService.getChatList(userId, cursor as string, limit ? parseInt(limit as string) : 20);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const markMessageViewed = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { messageId } = req.params;
        await ChatService.markMessageViewed(messageId as string, userId);
        return res.status(200).json({ success: true, message: "Marked viewed" });
    } catch (error: any) {
        if (error.message === "NOT_A_PARTICIPANT") {
            return res.status(403).json({ success: false, message: "Not a participant" });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMessages = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { conversationId } = req.params;
        const { cursor, limit } = req.query;
        const result = await ChatService.getMessages(conversationId as string, userId, cursor as string, limit ? parseInt(limit as string) : 20);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "NOT_A_PARTICIPANT") {
            return res.status(403).json({ success: false, message: "You are not a participant of this conversation" });
        }
        if (error.message === "CONVERSATION_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { conversationId } = req.params;
        const result = await ChatService.markAsRead(conversationId as string, userId);
        return res.status(200).json({ success: true, message: "Messages marked as read" });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getChatList = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { cursor, limit } = req.query;
        const result = await ChatService.getChatList(userId, cursor as string, limit ? parseInt(limit as string) : 20);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const editMessage = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ChatService.editMessage(req.body, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "CONTENT_REQUIRED") {
            return res.status(400).json({ success: false, message: "Message content is required" });
        }
        if (error.message === "MESSAGE_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Message not found" });
        }
        if (error.message === "NOT_THE_AUTHOR") {
            return res.status(403).json({ success: false, message: "You are not the author of this message" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const acceptChat = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { conversationId } = req.params;
        const result = await ChatService.acceptChat(conversationId as string, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "CANNOT_ACCEPT_OWN_REQUEST") {
            return res.status(400).json({ success: false, message: "Use existing chat" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const withdrawRequest = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { conversationId } = req.params;
        const result = await ChatService.withdrawRequest(conversationId as string, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "ONLY_INITIATOR_CAN_WITHDRAW") {
            return res.status(403).json({ success: false, message: "Only the sender can withdraw" });
        }
        if (error.message === "CAN_ONLY_WITHDRAW_PENDING") {
            return res.status(400).json({ success: false, message: "Can only withdraw pending requests" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const rejectChat = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { conversationId } = req.params;
        await ChatService.rejectChat(conversationId as string, userId);
        return res.status(200).json({ success: true, message: "Chat rejected" });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const blockChat = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { conversationId } = req.params;
        await ChatService.blockChat(conversationId as string, userId);
        return res.status(200).json({ success: true, message: "Chat blocked" });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const unblockChat = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { conversationId } = req.params;
        await ChatService.unblockChat(conversationId as string, userId);
        return res.status(200).json({ success: true, message: "Chat unblocked" });
    } catch (error: any) {
        if (error.message === "ONLY_BLOCKER_CAN_UNBLOCK") {
            return res.status(403).json({ success: false, message: "Only the blocker can unblock" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


export const getChatRequests = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { cursor, limit } = req.query;
        const result = await ChatService.getMyRequests(userId, cursor as string, limit ? parseInt(limit as string) : 20);
        console.log("chat requests", result)
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getBlockedChats = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { cursor, limit } = req.query;
        const result = await ChatService.getBlockedChats(userId, cursor as string, limit ? parseInt(limit as string) : 20);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


export const getTotalUnreadCount = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const count = await ChatService.getTotalUnreadCount(userId);
        return res.status(200).json({ success: true, count });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
export async function toggleMute(req: Request, res: Response) {
    try {
        const userId = req.user!.userId;
        const { conversationId } = req.params;
        const { isMuted } = req.body;

        const result = await ChatService.toggleMute(String(conversationId), userId, isMuted);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "NOT_A_PARTICIPANT") {
            return res.status(403).json({ success: false, message: "Not a participant" });
        }
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}
