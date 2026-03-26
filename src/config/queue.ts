import { Queue, Worker } from 'bullmq';
import { redis } from './redis.js';

export const BOT_QUEUE_NAME = 'bot-actions';
export const NOTIFICATION_QUEUE_NAME = 'notifications';
export const AI_REPLY_QUEUE_NAME = 'ai-replies';

export const botQueue = new Queue(BOT_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000,
    }
});

export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000,
    }
});

export const aiReplyQueue = new Queue(AI_REPLY_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000,
    }
});

export const createWorker = (queueName: string, processor: any) => {
    // Workers MUST have their own connection in BullMQ
    return new Worker(queueName, processor, {
        connection: redis.duplicate(),
        concurrency: 5
    });
};
