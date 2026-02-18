
import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { createReport } from "./report.controller.js";

const router = Router();

// Create a report
router.post("/", requireAuth, createReport);

export default router;
