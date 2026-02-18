import { Request, Response } from "express";
import { AppSettingService } from "./appSettings.service";

export class AppSettingController {
    static async getPrivacyPolicy(req: Request, res: Response) {
        try {
            const policy = await AppSettingService.getPrivacyPolicy();
            res.json({ success: true, policy });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async updateSetting(req: Request, res: Response) {
        try {
            const { key, value } = req.body;
            if (!key || !value) {
                return res.status(400).json({ success: false, message: "Key and Value are required" });
            }
            const setting = await AppSettingService.setSetting(key, value);
            res.json({ success: true, setting });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
