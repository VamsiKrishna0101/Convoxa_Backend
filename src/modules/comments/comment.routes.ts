import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
    createComment,
    getThreadComments,
    editComment,
    deleteComment,
    voteComment,
    removeVote,
    getUserCommentVotes
} from "./comment.controller.js";

const router = express.Router();

// Create comment (top-level or reply)
router.post("/", requireAuth, createComment);

// Get user votes
router.get("/votes/user/:userId", requireAuth, getUserCommentVotes);

// Get all comments for thread (ordered by path)
router.get("/thread/:threadId", getThreadComments);

// Edit comment
router.put("/", requireAuth, editComment);

// Delete comment (soft delete)
router.delete("/", requireAuth, deleteComment);

// Vote comment
router.post("/vote", requireAuth, voteComment);

// Remove vote
router.delete("/vote", requireAuth, removeVote);

export default router;
