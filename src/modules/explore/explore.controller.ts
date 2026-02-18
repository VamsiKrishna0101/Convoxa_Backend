import { Request, Response } from "express";
import { ExploreService } from "./explore.services";

export const getTrendingThreads = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId; // Optional - for vote status
        const result = await ExploreService.getTrendingThreads(userId);
        return res.status(200).json({ success: true, result });
    } catch (error) {
        console.error("Error fetching trending threads:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getRecommendedCommunities = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ExploreService.getRecommendedCommunities(userId);
        return res.status(200).json({ success: true, result });
    } catch (error) {
        console.error("Error fetching recommended communities:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getExploreCommunitiesByTopic = async (req: Request, res: Response) => {
    try {
        const result = await ExploreService.getExploreCommunitiesByTopic();
        return res.status(200).json({ success: true, result });
    } catch (error) {
        console.error("Error fetching communities by topic:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getCommunitiesByTopic = async (req: Request, res: Response) => {
    try {
        const { topic } = req.params;
        const cursor = req.query.cursor as string | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

        const topicStr = Array.isArray(topic) ? topic[0] : topic;
        const result = await ExploreService.getCommunitiesByTopic(topicStr.toUpperCase(), cursor, limit);
        return res.status(200).json({ success: true, result });
    } catch (error) {
        console.error("Error fetching communities by specific topic:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const search = async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;
        const type = (req.query.type as 'ALL' | 'COMMUNITY' | 'THREAD') || 'ALL';
        const cursor = req.query.cursor as string | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

        // If query is empty, service handles it, but good to check here too
        if (!query) {
            return res.status(400).json({ success: false, message: "Query parameter 'q' is required" });
        }

        const result = await ExploreService.search(query, type, cursor, limit);
        return res.status(200).json({ success: true, result });
    } catch (error) {
        console.error("Error searching:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
