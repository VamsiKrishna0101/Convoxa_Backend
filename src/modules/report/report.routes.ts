import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
    createReport,
    getCommunityReports,
    deleteReport
} from "./report.controller.js";

const router = express.Router();

// Report routes
router.post("/", requireAuth, createReport);
router.get("/community/:communityId", requireAuth, getCommunityReports);
router.delete("/:reportId", requireAuth, deleteReport);

export default router;
