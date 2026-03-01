import type { Request, Response } from "express";
import { GroupService } from "./group.services.js";

export const createGroup = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await GroupService.createGroup(req.body, userId);
        return res.status(201).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "INVALID_INPUT") {
            return res.status(400).json({ success: false, message: "Invalid input" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const joinGroup = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { groupId, inviteCode } = req.body;
        const result = await GroupService.joinGroup(groupId, userId, inviteCode);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "GROUP_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Group not found" });
        }
        if (error.message === "ALREADY_A_MEMBER") {
            return res.status(400).json({ success: false, message: "Already a member" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const sendMessage = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await GroupService.sendMessage(req.body, userId);
        return res.status(201).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "CONTENT_REQUIRED") {
            return res.status(400).json({ success: false, message: "Content is required" });
        }
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member of the group" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getGroupMessages = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { groupId } = req.params;
        const { cursor, limit } = req.query;
        const result = await GroupService.getGroupMessages(groupId as string, userId, cursor as string, limit ? parseInt(limit as string) : 20);
        return res.status(200).json({ success: true, result: result.messages, nextCursor: result.nextCursor });
    } catch (error: any) {
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member of the group" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { groupId } = req.params;
        const result = await GroupService.markAsRead(groupId as string, userId);
        return res.status(200).json({ success: true, message: "Messages marked as read" });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const markGroupMessageViewed = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { messageId } = req.params;
        await GroupService.markGroupMessageViewed(messageId as string, userId);
        return res.status(200).json({ success: true, message: "Marked viewed" });
    } catch (error: any) {
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member" });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMyGroups = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await GroupService.getMyGroups(userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const editGroupMessage = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await GroupService.editMessage(req.body, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "CONTENT_REQUIRED") {
            return res.status(400).json({ success: false, message: "Content is required" });
        }
        if (error.message === "NO_MESSAGE_FOUND") {
            return res.status(404).json({ success: false, message: "Message not found" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteGroupMessage = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { messageId } = req.body;
        const result = await GroupService.deleteMessage(messageId, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "MESSAGE_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Message not found" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
export async function toggleMute(req: Request, res: Response) {
    try {
        const userId = req.user!.userId;
        const { groupId } = req.params;
        const { isMuted } = req.body;
        const result = await GroupService.toggleMute(String(groupId), userId, isMuted);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member of the group" });
        }
        // console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function leaveGroup(req: Request, res: Response) {
    try {
        const userId = req.user!.userId;
        const { groupId } = req.params;
        const result = await GroupService.leaveGroup(String(groupId), userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member of the group" });
        }
        // console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getGroupDetails(req: Request, res: Response) {
    try {
        const userId = req.user!.userId;
        const { groupId } = req.params;
        const result = await GroupService.getGroupDetails(String(groupId), userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member of the group" });
        }
        if (error.message === "GROUP_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Group not found" });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}
