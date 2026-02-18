import type { Request, Response } from "express";
import { ProfileService } from "./profile.services";

export const getProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ProfileService.getProfile(userId, userId); // viewer is same as user for "My Profile"
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "USER_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getuserprofile = async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId as string;
        const viewerId = req.user?.userId; // Optional viewer ID
        const result = await ProfileService.getProfile(userId, viewerId);
        // console.log("From backend ")
        // console.log(result)
        return res.status(200).json({ success: true, result })
    } catch (error: any) {
        if (error.message === "USER_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getUserPosts = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const sort = req.query.sort === 'asc' ? 'asc' : 'desc';
        const result = await ProfileService.getPosts(userId as string, sort);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserReplies = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const sort = req.query.sort === 'asc' ? 'asc' : 'desc';
        const result = await ProfileService.getReplies(userId as string, sort);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserCommunities = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const result = await ProfileService.getCommunities(userId as string);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserFollowers = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const result = await ProfileService.getFollowers(userId as string);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserFollowing = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const result = await ProfileService.getFollowing(userId as string);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserUpvotes = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const sort = req.query.sort === 'asc' ? 'asc' : 'desc';
        const result = await ProfileService.getUpvotedThreads(userId as string, sort);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


// "My" endpoints now just delegate or use same logic with req.user.userId
export const getMyPosts = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const sort = req.query.sort === 'asc' ? 'asc' : 'desc';
        const result = await ProfileService.getPosts(userId, sort);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMyReplies = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const sort = req.query.sort === 'asc' ? 'asc' : 'desc';
        const result = await ProfileService.getReplies(userId, sort);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMyCommunities = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ProfileService.getCommunities(userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getFollowers = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ProfileService.getFollowers(userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getFollowing = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ProfileService.getFollowing(userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const followUser = async (req: Request, res: Response) => {
    try {
        const followerId = req.user!.userId;
        const { userId: followingId } = req.params;

        if (followerId === followingId) {
            return res.status(400).json({ success: false, message: "Cannot follow yourself" });
        }

        const result = await ProfileService.followUser(followerId, followingId as string);
        return res.status(200).json(result);
    } catch (error: any) {
        if (error.message === "ALREADY_FOLLOWING") {
            return res.status(400).json({ success: false, message: "Already following this user" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const unfollowUser = async (req: Request, res: Response) => {
    try {
        const followerId = req.user!.userId;
        const { userId: followingId } = req.params;

        const result = await ProfileService.unfollowUser(followerId, followingId as string);
        return res.status(200).json(result);
    } catch (error: any) {
        if (error.message === "NOT_FOLLOWING") {
            return res.status(400).json({ success: false, message: "Not following this user" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateAvatarConfig = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { avatarConfig } = req.body;

        if (!avatarConfig || typeof avatarConfig !== 'object') {
            return res.status(400).json({ success: false, message: "Invalid avatar configuration" });
        }

        const result = await ProfileService.updateAvatarConfig(userId, avatarConfig);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUpvotedThreads = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const sort = req.query.sort === 'asc' ? 'asc' : 'desc';
        // console.log(`[Backend] Fetching upvoted threads for user: ${userId}`);
        const result = await ProfileService.getUpvotedThreads(userId, sort);
        // console.log(`[Backend] Found ${result.length} upvoted threads`);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        // console.error("[Backend] Error fetching upvoted threads:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
