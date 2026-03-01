import { Queue, Worker } from 'bullmq';
import { redisConfig } from './redis.js';

const connection = {
    host: redisConfig.host,
    port: redisConfig.port,
    username: redisConfig.username,
    password: redisConfig.password,
};

export const BOT_QUEUE_NAME = 'bot-actions';

export const botQueue = new Queue(BOT_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000,
    }
});

export const createWorker = (processor: any) => {
    // Re-use connection for worker
    return new Worker(BOT_QUEUE_NAME, processor, {
        connection,
        concurrency: 5
    });
};
