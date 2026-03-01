import { Request, Response } from "express";
import { SavedService } from "./saved.services.js";

// THREADS
export const saveThread = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { threadId } = req.body; // Expecting threadId in body
        if (!threadId) return res.status(400).json({ success: false, message: "Thread ID is required" });

        const result = await SavedService.saveThread(userId, threadId);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error saving thread:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const removeSavedThread = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { threadId } = req.params;
        const result = await SavedService.removeSavedThread(userId, threadId as string);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error removing saved thread:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getSavedThreads = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await SavedService.getSavedThreads(userId);
        return res.status(200).json({ success: true, result });
    } catch (error) {
        console.error("Error fetching saved threads:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// COMMENTS
export const saveComment = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { commentId } = req.body;
        if (!commentId) return res.status(400).json({ success: false, message: "Comment ID is required" });

        const result = await SavedService.saveComment(userId, commentId);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error saving comment:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const removeSavedComment = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { commentId } = req.params;
        const result = await SavedService.removeSavedComment(userId, commentId as string);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error removing saved comment:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getSavedComments = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await SavedService.getSavedComments(userId);
        return res.status(200).json({ success: true, result });
    } catch (error) {
        console.error("Error fetching saved comments:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
