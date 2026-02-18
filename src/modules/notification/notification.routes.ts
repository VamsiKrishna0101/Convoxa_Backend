import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { getNotifications, getUnreadCount, markAsRead, createNotification, updateFcmToken, toggleCommunityMute, deleteNotification } from "./notification.controller.js";

const router = Router();

router.get("/", requireAuth, getNotifications);
router.post("/create", requireAuth, createNotification);
router.get("/unread", requireAuth, getUnreadCount);
router.post("/read", requireAuth, markAsRead);
router.delete("/:notificationId", requireAuth, deleteNotification);

// Push Notification Settings
router.post("/token", requireAuth, updateFcmToken);

router.post("/community/mute", requireAuth, toggleCommunityMute);

export default router;
