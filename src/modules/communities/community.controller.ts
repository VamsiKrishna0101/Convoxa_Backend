import type { Request, Response } from "express";
import { CommunityService } from "./community.services";

export const create = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;

        const result = await CommunityService.createCommunity(
            req.body,
            userId
        );

        return res.status(201).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "COMMUNITY NAME EXISTS") {
            return res.status(409).json({ success: false, message: "Community name already exists" });
        }

        if (error.message === "NAME AND DESCRIPTION REQUIRED") {
            return res.status(400).json({ success: false, message: "Name and description are required" });
        }
        console.log(error)

        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await CommunityService.updateCommunity(
            req.body,
            userId,
            req.params.communityId as string
        );
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "NOT AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Not authorized to update this community" });
        }
        if (error.message === "COMMUNITY NOT FOUND") {
            return res.status(404).json({ success: false, message: "Community not found" });
        }
        if (error.message === "USER NOT FOUND") {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteCommunity = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const communityId = req.params.communityId as string;
        await CommunityService.deleteCommunity(userId, communityId);
        return res.status(200).json({ success: true, message: "Community deleted successfully" });
    } catch (error: any) {
        if (error.message === "NOT AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Not authorized to delete this community" });
        }
        if (error.message === "COMMUNITY NOT FOUND") {
            return res.status(404).json({ success: false, message: "Community not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};



export const joinCommunity = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { communityId } = req.body;
        const id = communityId || req.params.communityId as string;

        await CommunityService.joinCommunity(userId, id);
        return res.status(200).json({ success: true, message: "Joined community successfully" });
    } catch (error: any) {
        if (error.message === "ALREADY_MEMBER") {
            return res.status(409).json({ success: false, message: "Already a member of this community" });
        }
        if (error.message === "COMMUNITY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Community not found" });
        }
        if (error.message === "PRIVATE_COMMUNITY_USE_CODE") {
            return res.status(403).json({ success: false, message: "This is a private community. Use a join code to join." });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const joinByCode = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { joinCode } = req.body;

        if (!joinCode) {
            return res.status(400).json({ success: false, message: "Join code is required" });
        }

        const result = await CommunityService.joinByCode(userId, joinCode);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "INVALID_JOIN_CODE") {
            return res.status(404).json({ success: false, message: "Invalid join code" });
        }
        if (error.message === "ALREADY_MEMBER") {
            return res.status(409).json({ success: false, message: "Already a member of this community" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const leaveCommunity = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        // Check params or body
        const communityId = (req.params.communityId || req.body.communityId) as string;

        await CommunityService.leaveCommunity(userId, communityId);
        return res.status(200).json({ success: true, message: "Left community successfully" });
    } catch (error: any) {
        if (error.message === "OWNER_CANNOT_LEAVE") {
            return res.status(400).json({ success: false, message: "Owner cannot leave their own community" });
        }
        if (error.message === "NOT_A_MEMBER") {
            return res.status(400).json({ success: false, message: "Not a member of this community" });
        }
        if (error.message === "COMMUNITY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Community not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserCommunities = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const communities = await CommunityService.getUserCommunities(userId);
        console.log("Calling Communities look")
        console.log(communities)
        return res.status(200).json({ success: true, result: communities });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getCommunityById = async (req: Request, res: Response) => {
    try {
        const { communityId } = req.params;
        const result = await CommunityService.getCommunityById(communityId as string);
        console.log(result)
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "COMMUNITY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Community not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ==================== COMMUNITY RULES ====================

export const CreateCommunityRule = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await CommunityService.CreateCommunityRule(req.body, userId);
        return res.status(201).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "INVALID_INPUT") {
            return res.status(400).json({ success: false, message: "Title and order are required" });
        }
        if (error.message === "COMMUNITY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Community not found" });
        }
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member of this community" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Only admins and moderators can create rules" });
        }
        if (error.message === "RULE_ORDER_ALREADY_EXISTS") {
            return res.status(409).json({ success: false, message: "A rule with this order number already exists" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const editCommunityRule = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { ruleId } = req.params;
        const result = await CommunityService.editCommunityRule(req.body, ruleId as string, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "INVALID_INPUT") {
            return res.status(400).json({ success: false, message: "Title and order are required" });
        }
        if (error.message === "RULE_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Rule not found" });
        }
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member of this community" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Only admins and moderators can edit rules" });
        }
        if (error.message === "RULE_ORDER_ALREADY_EXISTS") {
            return res.status(409).json({ success: false, message: "A rule with this order number already exists" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteCommunityRule = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { ruleId } = req.params;
        const result = await CommunityService.deleteCommunityRule(ruleId as string, userId);
        return res.status(200).json({ success: true, message: "Rule deleted successfully" });
    } catch (error: any) {
        if (error.message === "RULE_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Rule not found" });
        }
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member of this community" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Only admins and moderators can delete rules" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getCommunityRules = async (req: Request, res: Response) => {
    try {
        const { communityId } = req.params;
        const result = await CommunityService.getCommunityRules(communityId as string);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "COMMUNITY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Community not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const toggleMuteStatus = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { communityId } = req.params;
        const result = await CommunityService.toggleMuteStatus(userId, communityId as string);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "You are not a member of this community" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
