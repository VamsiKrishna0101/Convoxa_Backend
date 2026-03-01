
import type { Request, Response } from "express";
import { ReportService } from "./report.services.js";

export const createReport = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const result = await ReportService.createReport(req.body, userId);
        return res.status(201).json({ success: true, result });
    } catch (error: any) {
        if (error.message === "TARGET_REQUIRED") {
            return res.status(400).json({ success: false, message: "A target (thread, comment, reply, or user) is required" });
        }
        // console.error("Error creating report:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
