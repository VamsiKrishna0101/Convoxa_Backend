import { redis } from "../../config/redis";

// TTL Constants (In Seconds)
// STRICT 5MB LIMIT ENFORCEMENT
export const CACHE_TTL = {
    COMMUNITY_DETAILS: 1800, // 30 Minutes
    USER_COMMUNITIES: 600,   // 10 Minutes
    THREAD_DETAILS: 300,     // 5 Minutes (Threads change often)
    HOME_FEED_TRENDING: 120, // 2 Minutes (Real-time feel)
};

export class CacheService {

    /**
     * Get a typed value from cache
     */
    static async get<T>(key: string): Promise<T | null> {
        try {
            const data = await redis.get(key);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (error) {
            console.error(`Cache GET Error [${key}]:`, error);
            return null; // Fail safe
        }
    }

    /**
     * Set a value in cache with strict TTL
     */
    static async set(key: string, value: any, ttlSeconds: number): Promise<void> {
        try {
            const serialized = JSON.stringify(value);
            // Safety check: Don't cache massive objects to protect 5MB limit
            if (serialized.length > 50000) { // 50KB limit per object
                console.warn(`Cache SET skipped: Object too large (${serialized.length} bytes) for key ${key}`);
                return;
            }
            await redis.setex(key, ttlSeconds, serialized);
        } catch (error) {
            console.error(`Cache SET Error [${key}]:`, error);
        }
    }

    /**
     * Delete a key from cache
     */
    static async del(key: string): Promise<void> {
        try {
            await redis.del(key);
        } catch (error) {
            console.error(`Cache DEL Error [${key}]:`, error);
        }
    }

    /**
     * Delete multiple keys by pattern (Use carefully - SCAN is slow on large sets but okay for small)
     * For 5MB limit, keyset is small, so this is acceptable.
     */
    static async delPattern(pattern: string): Promise<void> {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(keys);
            }
        } catch (error) {
            console.error(`Cache DEL PATTERN Error [${pattern}]:`, error);
        }
    }

    // Key Generators
    static keys = {
        community: (id: string) => `community:${id}`,
        userCommunities: (userId: string) => `user-communities:${userId}`,
        thread: (id: string) => `thread:${id}`,
        trendingFeed: (limit: number) => `feed:trending:${limit}`
    }
}
