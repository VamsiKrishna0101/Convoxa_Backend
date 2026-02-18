import { Router } from "express";
import { AppSettingController } from "./appSettings.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/privacy-policy", AppSettingController.getPrivacyPolicy);
router.post("/update", requireAuth, AppSettingController.updateSetting);

export default router;
