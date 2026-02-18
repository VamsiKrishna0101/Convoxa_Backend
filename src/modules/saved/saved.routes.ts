import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import {
    saveThread,
    removeSavedThread,
    getSavedThreads,
    saveComment,
    removeSavedComment,
    getSavedComments
} from "./saved.controller";

const router = express.Router();

// Threads
router.post("/threads", requireAuth, saveThread);
router.delete("/threads/:threadId", requireAuth, removeSavedThread);
router.get("/threads", requireAuth, getSavedThreads);

// Comments
router.post("/comments", requireAuth, saveComment);
router.delete("/comments/:commentId", requireAuth, removeSavedComment);
router.get("/comments", requireAuth, getSavedComments);

export default router;
