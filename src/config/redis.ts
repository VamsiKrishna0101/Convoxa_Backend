import dotenv from 'dotenv';
dotenv.config();
import Redis from 'ioredis';

// Configuration from user
export const redisConfig = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '13491'),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
};

// console.log(`Connecting to Redis at ${redisConfig.host}:${redisConfig.port}`);

export const redis = new Redis({
    ...redisConfig,
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on('connect', () => {
    console.log('Redis connected successfully');
});

redis.on('error', (err) => {
    // console.error('Redis connection error:', err);
});
