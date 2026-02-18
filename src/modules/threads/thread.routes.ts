import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
    createThread,
    getThreadById,
    getAllThreadsOfCommunity,
    getAllThreadsOfUser,
    updateThread,
    deleteThread,
    getAllThreads,
    voteThread,
    removeVote,
    getAllVotesOfUser
} from "./thread.controller.js";

const router = express.Router();

// Get all threads
router.get("/all", getAllThreads);

// Create a thread
router.post("/", requireAuth, createThread);

// Get a specific thread
router.get("/:threadId", getThreadById);

// Get all threads of a community
router.get("/community/:communityId", getAllThreadsOfCommunity);

// Get all threads of a user
router.get("/user/:userId", getAllThreadsOfUser);

// Update a thread
router.patch("/:threadId", requireAuth, updateThread);

// Delete a thread
router.delete("/:threadId", requireAuth, deleteThread);

// Vote on thread
router.post("/vote", requireAuth, voteThread);

// Remove vote
router.delete("/vote/:threadId", requireAuth, removeVote);

// Get all votes of a user
router.get("/votes/user/:userId", getAllVotesOfUser);

export default router;
