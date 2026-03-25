import { Queue, Worker } from 'bullmq';
import { redisConfig } from './redis.js';

const connection = {
    host: redisConfig.host,
    port: redisConfig.port,
    username: redisConfig.username,
    password: redisConfig.password,
};

export const BOT_QUEUE_NAME = 'bot-actions';
export const NOTIFICATION_QUEUE_NAME = 'notifications';
export const AI_REPLY_QUEUE_NAME = 'ai-replies';

export const botQueue = new Queue(BOT_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000,
    }
});

export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000,
    }
});

export const aiReplyQueue = new Queue(AI_REPLY_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000,
    }
});

export const createWorker = (queueName: string, processor: any) => {
    // Re-use connection for worker
    return new Worker(queueName, processor, {
        connection,
        concurrency: 5
    });
};
