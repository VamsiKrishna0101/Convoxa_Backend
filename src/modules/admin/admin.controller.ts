import type { Request, Response } from "express";
import { AdminService } from "./admin.services";

export const getAdminCommunities = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const communities = await AdminService.getAdminCommunities(userId);
        return res.status(200).json({ success: true, result: communities });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


export const makeMod = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { targetUserId, communityId } = req.body;

        const result = await AdminService.makeMod({ targetUserId, communityId }, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        if (error.message === "USER_NOT_MEMBER") {
            return res.status(400).json({ success: false, message: "User is not a member of this community" });
        }
        if (error.message === "COMMUNITY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Community not found" });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMembersOfCommunity = async (req: Request, res: Response) => {
    try {
        const communityId = req.params.communityId as string;
        const members = await AdminService.getMembersOfCommunity(communityId);
        return res.status(200).json({ success: true, result: members });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getAllFlaggedThreadsOfCommunity = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const communityId = req.params.communityId as string;
        const threads = await AdminService.getAllFlaggedThreadsOfCommunity(communityId, userId);
        return res.status(200).json({ success: true, result: threads });
    } catch (error: any) {
        if (error.message === "NOT_AUTHORIZED") return res.status(403).json({ success: false, message: "Not authorized" });
        if (error.message === "NOT_A_MEMBER") return res.status(403).json({ success: false, message: "Not a member" });
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getAllReportsOfCommunity = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const communityId = req.params.communityId as string;
        const reports = await AdminService.getAllReportsOfCommunity(communityId, userId);
        return res.status(200).json({ success: true, result: reports });
    } catch (error: any) {
        if (error.message === "NOT_AUTHORIZED") return res.status(403).json({ success: false, message: "Not authorized" });
        if (error.message === "NOT_A_MEMBER") return res.status(403).json({ success: false, message: "Not a member" });
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

