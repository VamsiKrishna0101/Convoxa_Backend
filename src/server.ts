
import { env } from './config/env'
// Production Log Suppression
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

import { initIO } from './socket.js'
import http from "http"
import jwt from "jsonwebtoken"
import { initSocket } from './sockets/index.js'
import { initializeFirebase } from './config/firebase.js'

const app = express()
const PORT = env.PORT || 4000
const httpserver = http.createServer(app)

// Initialize external services
initializeFirebase();

import { createWorker, BOT_QUEUE_NAME } from './config/queue.js';
import { botProcessor } from './modules/bot/bot.worker.js';

createWorker(botProcessor);
// console.log(`Worker for queue ${BOT_QUEUE_NAME} started (Convoxa AI)`);

const io = initIO(httpserver)

// Socket authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
        return next(new Error("Authentication required"))
    }
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET!) as { userId: string }
        socket.data.userId = decoded.userId
        next()
    } catch (err) {
        next(new Error("Invalid token"))
    }
})

// Initialize socket handlers
initSocket(io)

app.use(express.json())

// Health Check Endpoint
app.get('/api/health/vamsi', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV || 'production'
    });
});

//routes
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


httpserver.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`)
})
