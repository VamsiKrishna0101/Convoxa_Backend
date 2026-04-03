import dotenv from 'dotenv';
dotenv.config();

// --- DEBUG: LOGS ENABLED ---
// I've commented this out so we can actually see why Google Cloud is failing.

if (process.env.NODE_ENV === 'production') {
    console.log = () => { };
    console.info = () => { };
    console.debug = () => { };
    console.warn = () => { };
}


import express from 'express'
import authRoutes from './modules/auth/auth.routes.js'
import communityRoutes from './modules/communities/community.routes.js'
import threadRoutes from './modules/threads/thread.routes.js'
import commentRoutes from './modules/comments/comment.routes.js'
import replyRoutes from './modules/replies/reply.routes.js'
import chatRoutes from './modules/chat/chat.routes.js'
import groupRoutes from './modules/groups/group.routes.js'
import profileRoutes from './modules/profile/profile.routes.js'
import reportRoutes from './modules/reports/report.routes.js'
import adminRoutes from './modules/admin/admin.routes.js'
import uploadRoutes from './modules/upload/upload.routes.js'
import homeFeedRoutes from './modules/homeFeed/homefeed.routes.js'
import exploreRoutes from './modules/explore/explore.routes.js'
import savedRoutes from './modules/saved/saved.routes.js'
import notificationRoutes from './modules/notification/notification.routes.js';
import appSettingRoutes from './modules/appSettings/appSettings.routes.js';
import feedbackRoutes from './modules/feedback/feedback.routes.js';
import helpRoutes from './modules/help/help.routes.js';
import pollRoutes from './modules/poll/poll.routes.js';

import { initIO } from './socket.js'
import http from "http"
import jwt from "jsonwebtoken"
import { initSocket } from './sockets/index.js'
import { initializeFirebase } from './config/firebase.js'
import { createWorker, BOT_QUEUE_NAME, NOTIFICATION_QUEUE_NAME, AI_REPLY_QUEUE_NAME } from './config/queue.js';
import { botProcessor } from './modules/bot/bot.worker.js';
import { notificationProcessor } from './modules/notification/notification.worker.js';
import { aiReplyProcessor } from './modules/bot/ai_reply.worker.js';

const app = express()
const PORT = process.env.PORT || 8080
const httpserver = http.createServer(app)

// Use a wrapper function to catch startup errors
async function startServer() {
    try {
        console.log("🚩 Checkpoint 1: Initializing Firebase...");
        initializeFirebase();
        console.log("✅ Firebase Initialized");

        console.log("🚩 Checkpoint 2: Starting BullMQ Workers...");
        try {
            // Start Bot Worker
            createWorker(BOT_QUEUE_NAME, botProcessor);
            console.log(`✅ Worker for queue ${BOT_QUEUE_NAME} started`);

            // Start Notification Worker
            createWorker(NOTIFICATION_QUEUE_NAME, notificationProcessor);
            console.log(`✅ Worker for queue ${NOTIFICATION_QUEUE_NAME} started`);

            // Start AI Reply Worker
            createWorker(AI_REPLY_QUEUE_NAME, aiReplyProcessor);
            console.log(`✅ Worker for queue ${AI_REPLY_QUEUE_NAME} started`);
        } catch (workerErr: any) {
            console.error("❌ Worker failed (Redis issue?):", workerErr.message);
            // We DON'T crash the whole app here so the web server can still start
        }

        console.log("🚩 Checkpoint 3: Initializing Sockets...");
        const io = initIO(httpserver)

        io.use((socket, next) => {
            const token = socket.handshake.auth.token
            if (!token) {
                return next(new Error("Authentication required"))
            }
            try {
                if (!process.env.JWT_SECRET) {
                    console.error("❌ CRITICAL: JWT_SECRET is undefined in environment!");
                }
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
                socket.data.userId = decoded.userId
                next()
            } catch (err) {
                next(new Error("Invalid token"))
            }
        })

        initSocket(io)
        console.log("✅ Sockets Initialized");

        app.use(express.json())

        // Health Check Endpoint
        app.get('/api/health/vamsi', (req, res) => {
            res.status(200).json({
                status: 'UP',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'production'
            });
        });

        console.log("🚩 Checkpoint 4: Mounting Routes...");
        app.use("/api/users", authRoutes)
        app.use("/api/community", communityRoutes)
        app.use("/api/threads", threadRoutes)
        app.use("/api/comments", commentRoutes)
        app.use("/api/replies", replyRoutes)
        app.use("/api/chat", chatRoutes)
        app.use("/api/groups", groupRoutes)
        app.use("/api/profile", profileRoutes)
        app.use("/api/report", reportRoutes)
        app.use("/api/admin", adminRoutes)
        app.use("/api/upload", uploadRoutes)
        app.use("/api/homefeed", homeFeedRoutes)
        app.use("/api/explore", exploreRoutes)
        app.use("/api/saved", savedRoutes)
        app.use("/api/notifications", notificationRoutes);
        app.use("/api/settings", appSettingRoutes);
        app.use("/api/feedback", feedbackRoutes);
        app.use('/api/help', helpRoutes);
        app.use('/api/poll', pollRoutes);

        console.log("🚩 Checkpoint 5: Attempting to Listen...");
        httpserver.on('error', (err: any) => {
            console.error("❌ HTTP SERVER ERROR:", err);
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use!`);
            }
            process.exit(1);
        });
        httpserver.listen(Number(PORT), "0.0.0.0", () => {
            console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`)
        })

    } catch (fatalError) {
        console.error("🛑 FATAL STARTUP ERROR:", fatalError);
        process.exit(1);
    }
}

startServer();
