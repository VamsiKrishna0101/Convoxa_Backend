import { Job } from 'bullmq';
import { ReplyBotService, BotContext } from './reply_bot.service.js';

export const aiReplyProcessor = async (job: Job<BotContext>) => {
    const context = job.data;

    try {
        console.log(`[AIReplyWorker] Processing mention in thread ${context.threadId}`);

        // Generate response via Grok
        const aiResponse = await ReplyBotService.generateResponse(context);

        if (aiResponse) {
            // Post the reply back to the platform
            await ReplyBotService.postAIReply(context, aiResponse);
            console.log(`[AIReplyWorker] Successfully posted AI reply to thread ${context.threadId}`);
        } else {
            console.log(`[AIReplyWorker] No response generated for thread ${context.threadId}`);
        }

    } catch (error: any) {
        console.error(`[AIReplyWorker] Failed to process job ${job.id}:`, error);
        throw error;
    }
};
