import express from "express";
import multer from "multer";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
    createConversation,
    sendMessage,
    deleteMessage,
    getConversations,
    getMessages,
    getChatList,
    editMessage,
    markAsRead,
    acceptChat,
    rejectChat,
    blockChat,
    unblockChat,
    getChatRequests,
    getTotalUnreadCount,
    getBlockedChats,
    toggleMute,
    withdrawRequest,
    uploadChatImage,
    markMessageViewed
} from "./chat.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

// Unread count
router.get("/unread-total", requireAuth, getTotalUnreadCount);

// Get all conversations of the current user
router.get("/conversations", requireAuth, getConversations);

// Get chat requests (Must be before :conversationId)
// Get chat requests (Must be before :conversationId)
router.get("/conversations/requests", requireAuth, getChatRequests);

// Get blocked chats
router.get("/conversations/blocked", requireAuth, getBlockedChats);

// Create a new conversation
router.post("/conversations", requireAuth, createConversation);

// Get messages of a conversation
router.get("/conversations/:conversationId/messages", requireAuth, getMessages);

// Send a message
router.post("/messages", requireAuth, sendMessage);
router.get("/chatlist", requireAuth, getChatList)
router.put("/messages", requireAuth, editMessage)

// Delete a message
router.delete("/messages", requireAuth, deleteMessage);

// Mark as Read
router.post("/conversations/:conversationId/read", requireAuth, markAsRead);

// View Once Mark Viewed
router.post("/messages/:messageId/viewed", requireAuth, markMessageViewed);

// Chat Requests
router.post("/conversations/:conversationId/accept", requireAuth, acceptChat);
router.post("/conversations/:conversationId/reject", requireAuth, rejectChat);
router.post("/conversations/:conversationId/block", requireAuth, blockChat);
router.post("/conversations/:conversationId/unblock", requireAuth, unblockChat);
router.post("/conversations/:conversationId/mute", requireAuth, toggleMute);
router.post("/conversations/:conversationId/withdraw", requireAuth, withdrawRequest);

// Image upload for chat (private bucket, returns signed URL)
router.post("/upload-image", requireAuth, upload.single("image"), uploadChatImage);

export default router;
