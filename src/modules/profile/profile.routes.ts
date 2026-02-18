import express from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import {
    getProfile,
    getMyPosts,
    getMyReplies,
    getMyCommunities,
    getFollowers,
    getFollowing,
    followUser,
    unfollowUser,
    getuserprofile,
    updateAvatarConfig,
    getUpvotedThreads,
    getUserPosts,
    getUserReplies,
    getUserCommunities,
    getUserFollowers,
    getUserFollowing,
    getUserUpvotes
} from "./profile.controller";

const router = express.Router();

// Get my profile
router.get("/", requireAuth, getProfile);

// Get others profile
router.get("/user/:userId", requireAuth, getuserprofile);

// Get my posts
router.get("/posts", requireAuth, getMyPosts);

// Get my replies
router.get("/replies", requireAuth, getMyReplies);

// Get my communities
router.get("/communities", requireAuth, getMyCommunities);

// Get my followers
router.get("/followers", requireAuth, getFollowers);

// Get who I am following
router.get("/following", requireAuth, getFollowing);

// Follow a user
router.post("/follow/:userId", requireAuth, followUser);

// Unfollow a user
router.delete("/follow/:userId", requireAuth, unfollowUser);

// Update avatar configuration
router.put("/avatar", requireAuth, updateAvatarConfig);

// Get my upvoted threads
router.get("/upvotes", requireAuth, getUpvotedThreads);

// Get ANY user's data
router.get("/user/:userId/posts", requireAuth, getUserPosts);
router.get("/user/:userId/replies", requireAuth, getUserReplies);
router.get("/user/:userId/communities", requireAuth, getUserCommunities);
router.get("/user/:userId/followers", requireAuth, getUserFollowers);
router.get("/user/:userId/following", requireAuth, getUserFollowing);
router.get("/user/:userId/upvotes", requireAuth, getUserUpvotes);

export default router;

