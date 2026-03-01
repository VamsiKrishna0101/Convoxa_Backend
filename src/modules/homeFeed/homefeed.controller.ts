import { Request, Response } from "express";
import { HomeFeedService } from "./homefeed.services.js";

export const getHomeFeed = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const cursor = req.query.cursor as string | undefined;
        const limit = parseInt(req.query.limit as string) || 20;
        const sortBy = (req.query.sortBy as 'HOT' | 'NEW' | 'TOP') || 'HOT';

        const result = await HomeFeedService.getHomeFeed(userId, cursor, Math.min(limit, 50), sortBy);
        // console.log("feed result", result.data.length, "items");
        return res.status(200).json({ success: true, result });
    } catch (error) {
        // console.error("Error fetching home feed:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
