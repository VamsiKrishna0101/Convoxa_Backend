import { Request, Response } from "express";
import { FeedbackService } from "./feedback.service.js";

export class FeedbackController {
    static async submitFeedback(req: Request, res: Response) {
        try {
            const { content, category, rating } = req.body;
            const user = (req as any).user;

            if (!content) {
                return res.status(400).json({ success: false, message: "Content is required" });
            }

            const feedback = await FeedbackService.submitFeedback({
                userId: user.userId,
                username: user.username,
                content,
                category,
                rating
            });

            res.json({ success: true, message: "Feedback submitted successfully", feedback });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async getAllFeedback(req: Request, res: Response) {
        try {
            // In a real app, this would be admin-only
            const feedbacks = await FeedbackService.getAllFeedback();
            res.json({ success: true, feedbacks });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
