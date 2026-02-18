import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { getHomeFeed } from "./homefeed.controller";

const router = express.Router();

// Get Home Feed
router.get("/", requireAuth, getHomeFeed);

export default router;
