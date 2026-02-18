import type { Request, Response } from "express";
import { CommentService } from "./comments.services";

export const createComment = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await CommentService.createComment(req.body, userId);
        return res.status(201).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "CONTENT_REQUIRED") {
            return res.status(400).json({ success: false, message: "Content is required" });
        }
        if (error.message === "THREAD_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Thread not found" });
        }
        if (error.message === "PARENT_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Parent comment not found" });
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

export const voteComment = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { commentId, type } = req.body;

        if (!commentId || !type) {
            return res.status(400).json({ success: false, message: "Comment ID and type are required" });
        }

        const result = await CommentService.voteComment(commentId, userId, type);
        return res.status(200).json(result);
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const removeVote = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { commentId } = req.body; // or params? Let's use body for consistency or params if RESTful? 
        // Usually DELETE uses params or body. Let's use body to match request.

        if (!commentId) {
            return res.status(400).json({ success: false, message: "Comment ID is required" });
        }

        const result = await CommentService.removeVote(commentId, userId);
        return res.status(200).json(result);
    } catch (error: any) {
        if (error.message === "VOTE_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Vote not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getThreadComments = async (req: Request, res: Response) => {
    try {
        const { threadId } = req.params;
        const userId = req.user?.userId; // Optional auth for fetching votes
        const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
        const limit = req.query.limit ? parseInt(String(req.query.limit)) : 20;
        const rawSortBy = req.query.sortBy ? String(req.query.sortBy) : "TOP";
        const sortBy = (["TOP", "NEW", "OLD"].includes(rawSortBy) ? rawSortBy : "TOP") as "TOP" | "NEW" | "OLD";

        console.log("🔍 [Contoller] getThreadComments query:", req.query, "-> sortBy:", sortBy);

        const result = await CommentService.getThreadComments(String(threadId), userId, cursor, limit, sortBy);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "THREAD_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Thread not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const editComment = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await CommentService.editComment(req.body, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "CONTENT_REQUIRED") {
            return res.status(400).json({ success: false, message: "Content is required" });
        }
        if (error.message === "COMMENT_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        if (error.message === "COMMENT_DELETED") {
            return res.status(400).json({ success: false, message: "Cannot edit deleted comment" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteComment = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await CommentService.deleteComment(req.body, userId);
        console.log(result)
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "COMMENT_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserCommentVotes = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const result = await CommentService.getUserCommentVotes(String(userId));
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        console.log("Error fetching user comment votes:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
