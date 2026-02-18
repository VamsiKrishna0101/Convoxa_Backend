import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config({ override: false });

function getEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`❌ Missing environment variable: ${key}`);
    }
    return value;
}

export const env = {
    DATABASE_URL: getEnv("DATABASE_URL"),
    JWT_SECRET: getEnv("JWT_SECRET"),
    PORT: process.env.PORT || "4000",
    JWT_REFRESH_SECRET: getEnv("JWT_REFRESH_SECRET"),
    GEMINI_API_KEY: getEnv("GEMINI_API_KEY"),
    BREVO_API_KEY: process.env.BREVO_API_KEY, // Optional, so no getEnv check
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_USERNAME: process.env.REDIS_USERNAME,
    NODE_ENV: process.env.NODE_ENV
};
