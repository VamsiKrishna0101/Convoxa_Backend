import { Router } from "express";
import { getSignedUploadUrl } from "./upload.controller.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";

const router = Router();

// POST /api/upload/signed-url - Get signed URL for uploading images
// Requires authentication
router.post("/signed-url", requireAuth, getSignedUploadUrl);

export default router;
