import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
    createGroup,
    joinGroup,
    sendMessage,
    getGroupMessages,
    getMyGroups,
    editGroupMessage,
    deleteGroupMessage,
    markAsRead,
    toggleMute,
    leaveGroup,
    getGroupDetails
} from "./group.controller.js";

const router = express.Router();

// Create a new group
router.post("/", requireAuth, createGroup);

// Join a group
router.post("/join", requireAuth, joinGroup);

// Get my groups
router.get("/my-groups", requireAuth, getMyGroups);

// Get messages of a group
router.get("/:groupId/messages", requireAuth, getGroupMessages);

// Send a message
router.post("/messages", requireAuth, sendMessage);

// Edit a message
router.put("/messages", requireAuth, editGroupMessage);

// Delete a message
router.delete("/messages", requireAuth, deleteGroupMessage);


// Mute Group
router.post("/:groupId/mute", requireAuth, toggleMute);

// Mark as read
router.post("/:groupId/read", requireAuth, markAsRead);

// Leave Group
router.post("/:groupId/leave", requireAuth, leaveGroup);

// Get Group Details
router.get("/:groupId", requireAuth, getGroupDetails);

export default router;
