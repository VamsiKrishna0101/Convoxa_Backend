import express from "express";
import { optionalAuth } from "../../middlewares/optionalAuth.middleware.js";
import { getHomeFeed } from "./homefeed.controller.js";

const router = express.Router();

// Get Home Feed
router.get("/", optionalAuth, getHomeFeed);

export default router;
