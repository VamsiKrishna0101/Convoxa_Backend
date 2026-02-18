import { Job } from 'bullmq';
import { BotService } from './bot.service.js';
import { CommentService } from '../comments/comments.services.js';
import prisma from '../../config/prisma.js';
import { BotJobPayload } from './bot.types.js';

export const botProcessor = async (job: Job<BotJobPayload>) => {
    const { type } = job.data;

    try {
        // 1. Get Bot User
        const botUser = await BotService.getBotUser();

        if (type === 'COMMENT_ON_THREAD') {
            const { threadId } = job.data;
            if (!threadId) return;

            // 2. Fetch Thread Content
            const thread = await prisma.thread.findUnique({ where: { id: threadId } });
            if (!thread) return;

            // 3. Construct Prompt with Thread Context
            // USER REQUEST: ensuring prompt relevance
            const prompt = `
            You are "Convoxa AI", a friendly community bot.
            Read this post and write a relevant, engaging comment (max 20 words).
            
            Thread Title: "${thread.title}"
            Thread Content: "${thread.content}"
            Community Topic: "${thread.communityName}"
            
            Do not sound robotic. Be helpful or encouraging.
            `;

            // 4. Generate Content via Gemini
            const content = await BotService.generateContent(prompt);

            if (!content) {
                console.log(`[BotWorker] Generation failed or returned empty. Skipping comment for thread ${threadId}.`);
                return;
            }

            console.log(`[BotWorker] Posting comment on thread ${threadId}: ${content}`);

            // 5. Post Comment
            await CommentService.createComment({
                content,
                threadId
            }, botUser.id);
        }

    } catch (error) {
        console.error(`[BotWorker] Failed to process job ${job.id}:`, error);
        throw error;
    }
};
