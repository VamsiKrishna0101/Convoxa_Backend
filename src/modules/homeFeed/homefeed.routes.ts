import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { getHomeFeed } from "./homefeed.controller.js";

const router = express.Router();

// Get Home Feed
router.get("/", requireAuth, getHomeFeed);

export default router;
