import type { Request, Response } from "express";
import { ReplyService } from "./reply.services.js";

export const createReply = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ReplyService.createReply(req.body, userId);
        return res.status(201).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "CONTENT_REQUIRED") {
            return res.status(400).json({ success: false, message: "Content is required" });
        }
        if (error.message === "COMMENT_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        if (error.message === "PARENT_REPLY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Parent reply not found" });
        }
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member of this community" });
        }
        if (error.message === "USER_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getCommentReplies = async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;
        const userId = req.user?.userId; // Optional, for vote status
        const cursor = req.query.cursor as string | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

        const result = await ReplyService.getCommentReplies(commentId as string, userId, cursor, limit);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "COMMENT_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const editReply = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ReplyService.editReply(req.body, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "CONTENT_REQUIRED") {
            return res.status(400).json({ success: false, message: "Content is required" });
        }
        if (error.message === "REPLY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Reply not found" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        if (error.message === "REPLY_DELETED") {
            return res.status(400).json({ success: false, message: "Cannot edit deleted reply" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteReply = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ReplyService.deleteReply(req.body, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "REPLY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Reply not found" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const voteReply = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { replyId, type } = req.body;

        if (!replyId || !type || (type !== 'UP' && type !== 'DOWN')) {
            return res.status(400).json({ success: false, message: "Reply ID and valid type (UP/DOWN) are required" });
        }

        const result = await ReplyService.voteReply(replyId, userId, type);
        return res.status(200).json(result);
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const removeVote = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { replyId } = req.body;

        if (!replyId) {
            return res.status(400).json({ success: false, message: "Reply ID is required" });
        }

        const result = await ReplyService.removeVote(replyId, userId);
        return res.status(200).json(result);
    } catch (error: any) {
        if (error.message === "VOTE_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Vote not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserReplyVotes = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const result = await ReplyService.getUserReplyVotes(userId as string);
        return res.status(200).json(result);
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
