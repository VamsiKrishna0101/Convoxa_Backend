import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import {
    create,
    update,
    deleteCommunity,
    joinCommunity,
    joinByCode,
    leaveCommunity,
    getUserCommunities,
    getCommunityById,
    CreateCommunityRule,
    editCommunityRule,
    deleteCommunityRule,
    getCommunityRules,
    toggleMuteStatus
} from "./community.controller";

const router = express.Router();

// Community management
router.post("/create", requireAuth, create);
router.get("/specific/:communityId", getCommunityById);
router.patch("/:communityId", requireAuth, update);
router.delete("/:communityId", requireAuth, deleteCommunity);
router.put("/:communityId/mute", requireAuth, toggleMuteStatus);


// Membership actions
router.post("/join", requireAuth, joinCommunity);
router.post("/join-by-code", requireAuth, joinByCode);
router.post("/leave", requireAuth, leaveCommunity);

// Listings
router.get("/my-communities", requireAuth, getUserCommunities);

// Community Rules
router.post("/rules", requireAuth, CreateCommunityRule);
router.put("/rules/:ruleId", requireAuth, editCommunityRule);
router.delete("/rules/:ruleId", requireAuth, deleteCommunityRule);
router.get("/:communityId/rules", getCommunityRules);

export default router;
