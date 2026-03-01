import type { Request, Response } from "express";
import { ThreadService } from "./thread.services.js";

export const createThread = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ThreadService.createThread(req.body, userId);
        return res.status(201).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "TITLE_CONTENT_COMMUNITY_REQUIRED") {
            return res.status(400).json({ success: false, message: "Title, content, and communityId are required" });
        }
        if (error.message === "USER_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (error.message === "COMMUNITY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Community not found" });
        }
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "You must be a member of the community to post" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getThreadById = async (req: Request, res: Response) => {
    try {
        const { threadId } = req.params;
        const userId = req.user?.userId;  // Optional - will show if user voted
        const result = await ThreadService.getThreadById(threadId as string, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "THREAD_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Thread not found" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getAllThreadsOfCommunity = async (req: Request, res: Response) => {
    try {
        const { communityId } = req.params;
        const userId = req.user?.userId;  // Optional
        const cursor = req.query.cursor as string | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
        const search = req.query.search as string | undefined;
        const sortBy = req.query.sortBy as "new" | "old" | "top" | "controversial" | undefined;

        const result = await ThreadService.getAllThreadsOfCommunity(communityId as string, userId, cursor, limit, search, sortBy);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "COMMUNITY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Community not found" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getAllThreadsOfUser = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const requesterId = req.user?.userId;  // Optional
        const cursor = req.query.cursor as string | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

        const result = await ThreadService.getAllThreadsOfUser(userId as string, requesterId, cursor, limit);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "USER_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateThread = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { threadId } = req.params;
        const result = await ThreadService.updateThread(threadId as string, req.body, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "THREAD_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Thread not found" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Not authorized to update this thread" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteThread = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { threadId } = req.params;
        const result = await ThreadService.deleteThread(threadId as string, userId);
        return res.status(200).json({ success: true, message: "Thread deleted successfully" });
    } catch (error: any) {
        if (error.message === "THREAD_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Thread not found" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Not authorized to delete this thread" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getAllThreads = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;  // Optional
        const result = await ThreadService.getAllThreads(userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const voteThread = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ThreadService.voteThread(req.body, userId);
        // console.log("Vote Result")
        // console.log(result)
        // console.log("End vote")
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "THREAD_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Thread not found" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const removeVote = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { threadId } = req.params;
        const result = await ThreadService.removeVote(threadId as string, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "VOTE_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Vote not found" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getAllVotesOfUser = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const result = await ThreadService.getAllVotesOfUser(userId as string);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

