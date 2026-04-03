import prisma from "../../config/prisma.js";
import { PollInput } from "./poll.types.js";
import { CacheService } from "../common/cache.service.js";

export class PollService {
    static async createPoll(input: PollInput, userId: string) {
        // 1. Validation
        if (!input.options || input.options.length < 2) {
            throw new Error("Poll must have at least 2 options");
        }
        if (input.options.length > 10) {
            throw new Error("Poll cannot have more than 10 options");
        }

        // 2. Resource Checks
        const [user, community, membership] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { username: true } }),
            prisma.community.findUnique({
                where: { id: input.communityId },
                select: { name: true, allowAnonymous: true }
            }),
            prisma.communityMember.findUnique({
                where: { userId_communityId: { userId, communityId: input.communityId } }
            })
        ]);

        if (!user || !community) throw new Error("User or Community not found");
        if (!membership) throw new Error("You are not a member of this community");

        // 3. Anonymity Logic: Only allow anonymous if community allows it
        const finalIsAnonymous = input.isAnonymous && community.allowAnonymous;

        // 4. Atomic Transaction
        return await prisma.thread.create({
            data: {
                title: input.question, // The question is our thread title
                content: input.content || "",
                authorId: userId,
                communityId: input.communityId,
                username: user.username,
                communityName: community.name,
                isAnonymous: finalIsAnonymous,
                type: 'POLL',
                poll: {
                    create: {
                        options: {
                            create: input.options.map(opt => ({
                                text: opt
                            }))
                        }
                    }
                }
            },
            include: {
                poll: {
                    include: {
                        options: true
                    }
                }
            }
        });
    }

    /**
     * Casts a vote in a poll. Uses a transaction to ensure atomic updates to counters.
     */
    static async vote(userId: string, pollId: string, optionId: string) {
        return await prisma.$transaction(async (tx) => {
            // 1. Check if user already voted in this poll
            const existingVote = await tx.pollVote.findUnique({
                where: { pollId_userId: { pollId, userId } }
            });
            if (existingVote) throw new Error("You have already voted in this poll");

            // 2. Optional: Check if poll exists and isn't expired
            const poll = await tx.poll.findUnique({ 
                where: { id: pollId },
                select: { expiresAt: true, threadId: true } 
            });
            if (!poll) throw new Error("Poll not found");
            if (poll.expiresAt && new Date() > new Date(poll.expiresAt)) {
                throw new Error("This poll has expired");
            }

            // 3. Create Vote
            const vote = await tx.pollVote.create({
                data: { userId, pollId, optionId }
            });

            // 4. Update Denormalized Counters
            await tx.poll.update({
                where: { id: pollId },
                data: { totalVotes: { increment: 1 } }
            });

            await tx.option.update({
                where: { id: optionId },
                data: { votesCount: { increment: 1 } }
            });

            // 5. Invalidate Thread Cache (CRITICAL for real-time visibility)
            if (poll.threadId) {
                await CacheService.del(CacheService.keys.thread(poll.threadId));
            }

            return vote;
        });
    }

}
