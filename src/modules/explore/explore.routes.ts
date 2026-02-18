import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
    getTrendingThreads,
    getRecommendedCommunities,
    getExploreCommunitiesByTopic,
    getCommunitiesByTopic,
    search
} from "./explore.controller";

const router = express.Router();

// Search (public)
router.get("/search", search);

// Get trending threads (public, no auth required)
router.get("/trending", getTrendingThreads);

// Get recommended communities (auth required)
router.get("/communities/recommended", requireAuth, getRecommendedCommunities);

// Get all communities grouped by topic (public)
router.get("/communities/topics", getExploreCommunitiesByTopic);

// Get specific topic communities with pagination
router.get("/communities/topic/:topic", getCommunitiesByTopic);

export default router;
