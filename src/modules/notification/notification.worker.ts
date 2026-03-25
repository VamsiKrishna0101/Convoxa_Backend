import { Job } from 'bullmq';
import prisma from '../../config/prisma.js';
import { NotificationService } from './notification.services.js';
import { User } from '@prisma/client';
import { redis } from '../../config/redis.js';

export interface NotificationJobPayload {
    type: 'BROADCAST_NEW_THREAD';
    threadId: string;
    communityId: string;
    authorId: string;
    title: string;
    body: string;
    imageUrl?: string;
}

export const notificationProcessor = async (job: Job<NotificationJobPayload>) => {
    const { type, threadId, communityId, authorId, title, body, imageUrl } = job.data;

    try {
        if (type === 'BROADCAST_NEW_THREAD') {
            console.log(`[NotificationWorker] Starting broadcast for thread ${threadId}`);

            // Fetch users in chunks to avoid memory issues (e.g. 500 at a time)
            const CHUNK_SIZE = 500;
            let lastId: string | undefined = undefined;
            let totalSent = 0;

            while (true) {
                const nonMembers: User[] = await prisma.user.findMany({
                    where: {
                        expopushtoken: { not: null, notIn: [""] },
                        id: { not: authorId },
                        communitymember: {
                            none: { communityId }
                        },
                        // Cursor-based pagination for efficiency
                        ...(lastId ? { id: { gt: lastId } } : {})
                    },
                    take: CHUNK_SIZE,
                    orderBy: { id: 'asc' }
                });

                if (nonMembers.length === 0) break;

                let chunkSent = 0;
                let chunkSkipped = 0;

                // Send in parallel within the chunk
                await Promise.all(nonMembers.map(async (user: User) => {
                    const throttleKey = `push_throttle:discovery:${user.id}`;
                    const isThrottled = await redis.get(throttleKey);

                    if (isThrottled) {
                        chunkSkipped++;
                        return;
                    }

                    await NotificationService.sendPushNotification(
                        user.id,
                        title,
                        body,
                        { type: "NEW_THREAD", threadId, communityId, isDiscovery: true },
                        imageUrl
                    ).catch(() => {});

                    // Set throttle for 4 hours (14,400 seconds)
                    await redis.set(throttleKey, "1", "EX", 14400);
                    chunkSent++;
                }));

                totalSent += chunkSent;
                lastId = nonMembers[nonMembers.length - 1].id;
                
                console.log(`[NotificationWorker] Discovery Chunk: Sent ${chunkSent}, Skipped ${chunkSkipped} (throttled). Total sent: ${totalSent}`);
                
                // Small delay between chunks to let the event loop breathe
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`[NotificationWorker] Broadcast complete. Total sent: ${totalSent} for thread ${threadId}`);
        }
    } catch (error) {
        console.error(`[NotificationWorker] Failed to process job ${job.id}:`, error);
        throw error;
    }
};
