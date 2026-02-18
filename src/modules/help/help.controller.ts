import { Request, Response } from 'express';
import { HelpService } from './help.service';

export class HelpController {
    static async submitHelpRequest(req: Request, res: Response) {
        try {
            const { email, content } = req.body;
            // Get user from request if authenticated (optional)
            const userId = (req as any).user?.userId;

            if (!email || !content) {
                return res.status(400).json({
                    success: false,
                    message: "Email and content are required."
                });
            }

            const request = await HelpService.submitRequest(email, content, userId);

            res.status(201).json({
                success: true,
                message: "Help request submitted successfully. We will review it shortly.",
                data: request
            });
        } catch (error: any) {
            console.error("Help Submission Error:", error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async getMyHelpRequests(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const requests = await HelpService.getRequestsByUser(userId);
            res.status(200).json({
                success: true,
                data: requests
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async getHelpRequests(req: Request, res: Response) {
        try {
            const requests = await HelpService.getAllRequests();
            res.status(200).json({
                success: true,
                data: requests
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}
