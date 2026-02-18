import { Request, Response } from "express";
import { ReportService } from "./report.services";

export const createReport = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ReportService.createReport(req.body, userId);
        // console.log(result)
        return res.status(201).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "THREAD_OR_COMMENT_REQUIRED") {
            return res.status(400).json({ success: false, message: "Must report either a thread or comment" });
        }
        if (error.message === "CANNOT_REPORT_BOTH") {
            return res.status(400).json({ success: false, message: "Cannot report both thread and comment" });
        }
        if (error.message === "COMMUNITY_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Community not found" });
        }
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "You must be a member to report" });
        }
        if (error.message === "THREAD_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Thread not found" });
        }
        if (error.message === "COMMENT_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        if (error.message === "RULE_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Rule not found" });
        }
        if (error.message === "THREAD_NOT_IN_COMMUNITY") {
            return res.status(400).json({ success: false, message: "Thread does not belong to this community" });
        }
        if (error.message === "COMMENT_NOT_IN_COMMUNITY") {
            return res.status(400).json({ success: false, message: "Comment does not belong to this community" });
        }
        if (error.message === "RULE_NOT_IN_COMMUNITY") {
            return res.status(400).json({ success: false, message: "Rule does not belong to this community" });
        }
        if (error.message === "ALREADY_REPORTED") {
            return res.status(409).json({ success: false, message: "You have already reported this content" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getCommunityReports = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { communityId } = req.params;
        const result = await ReportService.getCommunityReports(communityId as string, userId);
        return res.status(200).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member of this community" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Only admins and moderators can view reports" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteReport = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { reportId } = req.params;
        const result = await ReportService.deleteReport(reportId as string, userId);
        return res.status(200).json({ success: true, message: "Report deleted successfully" });
    } catch (error: any) {
        if (error.message === "REPORT_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Report not found" });
        }
        if (error.message === "NOT_A_MEMBER") {
            return res.status(403).json({ success: false, message: "Not a member of this community" });
        }
        if (error.message === "NOT_AUTHORIZED") {
            return res.status(403).json({ success: false, message: "Only admins and moderators can delete reports" });
        }
        // console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
