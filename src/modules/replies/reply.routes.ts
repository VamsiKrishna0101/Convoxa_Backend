import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
    createReply,
    getCommentReplies,
    editReply,
    deleteReply,
    voteReply,
    removeVote,
    getUserReplyVotes
} from "./reply.controller.js";
import { optionalAuth } from "../../middlewares/optionalAuth.middleware.js";

const router = express.Router();

// Create reply (top-level or nested)
router.post("/", requireAuth, createReply);

// Get all replies for comment (ordered by path)
router.get("/comment/:commentId", optionalAuth, getCommentReplies);

// Edit reply
router.put("/", requireAuth, editReply);

// Delete reply (soft delete)
router.delete("/", requireAuth, deleteReply);

// Vote on reply
router.post("/vote", requireAuth, voteReply);

// Remove vote
router.delete("/vote", requireAuth, removeVote);

// Get user reply votes
router.get("/votes/user/:userId", requireAuth, getUserReplyVotes);

export default router;
