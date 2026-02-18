import { Router } from "express";
import { FeedbackController } from "./feedback.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/submit", requireAuth, FeedbackController.submitFeedback);
router.get("/all", requireAuth, FeedbackController.getAllFeedback);

export default router;
