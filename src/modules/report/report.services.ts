import prisma from '../../config/prisma';
import { ReportInput, ReportOutput } from './report.types';

export class ReportService {
    static async createReport(input: ReportInput, userId: string): Promise<ReportOutput> {
        let { communityId, threadId, commentId, replyId, ruleId, reason } = input;

        // Validation: Must report at least thread OR comment OR reply
        if (!threadId && !commentId && !replyId) {
            throw new Error("THREAD_OR_COMMENT_REQUIRED");
        }

        // Check community exists
        const community = await prisma.community.findUnique({
            where: { id: communityId }
        });
        if (!community) throw new Error("COMMUNITY_NOT_FOUND");

        // Check if user is member of community
        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: { userId, communityId }
            }
        });
        if (!membership) throw new Error("NOT_A_MEMBER");

        // Check thread exists if reporting thread
        if (threadId) {
            const thread = await prisma.thread.findUnique({
                where: { id: threadId }
            });
            if (!thread) throw new Error("THREAD_NOT_FOUND");
            if (thread.communityId !== communityId) throw new Error("THREAD_NOT_IN_COMMUNITY");
        }

        // Check comment/reply existence and resolve ambiguity
        if (commentId) {
            // First try to find as a Comment
            const comment = await prisma.comment.findUnique({
                where: { id: commentId },
                include: { thread: true }
            });

            if (comment) {
                if (comment.thread.communityId !== communityId) {
                    throw new Error("COMMENT_NOT_IN_COMMUNITY");
                }
            } else {
                // Not found as Comment, try as Reply
                const reply = await prisma.reply.findUnique({
                    where: { id: commentId },
                    include: { comment: { include: { thread: true } } }
                });

                if (reply) {
                    if (reply.comment.thread.communityId !== communityId) {
                        throw new Error("COMMENT_NOT_IN_COMMUNITY");
                    }
                    // Move commentId to replyId for correct database storage
                    replyId = commentId;
                    commentId = undefined;
                } else {
                    throw new Error("COMMENT_NOT_FOUND");
                }
            }
        } else if (replyId) {
            const reply = await prisma.reply.findUnique({
                where: { id: replyId },
                include: { comment: { include: { thread: true } } }
            });
            if (!reply) throw new Error("REPLY_NOT_FOUND");
            if (reply.comment.thread.communityId !== communityId) {
                throw new Error("COMMENT_NOT_IN_COMMUNITY");
            }
        }

        // Check rule exists if provided
        if (ruleId) {
            const rule = await prisma.communityRule.findUnique({
                where: { id: ruleId }
            });
            if (!rule) throw new Error("RULE_NOT_FOUND");
            if (rule.communityId !== communityId) throw new Error("RULE_NOT_IN_COMMUNITY");
        }

        // Check for duplicate report
        const existingReport = await prisma.report.findFirst({
            where: {
                reporterId: userId,
                ...(threadId ? { threadId } : {}),
                ...(commentId ? { commentId } : {}),
                ...(replyId ? { replyId } : {})
            }
        });

        if (existingReport) throw new Error("ALREADY_REPORTED");

        const report = await prisma.report.create({
            data: {
                reporterId: userId,
                communityId,
                threadId: threadId || null,
                commentId: commentId || null,
                replyId: replyId || null,
                ruleId: ruleId || null,
                reason: reason || ""
            } as any
        });

        return {
            id: report.id,
            reporterId: report.reporterId,
            communityId: report.communityId,
            threadId: report.threadId ?? undefined,
            commentId: report.commentId ?? undefined,
            replyId: report.replyId ?? undefined,
            ruleId: report.ruleId ?? undefined,
            reason: report.reason ?? undefined,
            createdAt: report.createdAt.toISOString()
        };
    }

    static async getCommunityReports(communityId: string, userId: string): Promise<ReportOutput[]> {
        // Check if user is admin/moderator
        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: { userId, communityId }
            }
        });

        if (!membership) throw new Error("NOT_A_MEMBER");
        if (membership.role !== "ADMIN" && membership.role !== "MODERATOR") {
            throw new Error("NOT_AUTHORIZED");
        }

        const reports = await prisma.report.findMany({
            where: { communityId },
            orderBy: { createdAt: 'desc' }
        });

        return reports.map(report => ({
            id: report.id,
            reporterId: report.reporterId,
            communityId: report.communityId,
            threadId: report.threadId ?? undefined,
            commentId: report.commentId ?? undefined,
            replyId: report.replyId ?? undefined,
            ruleId: report.ruleId ?? undefined,
            reason: report.reason ?? undefined,
            createdAt: report.createdAt.toISOString()
        }));
    }

    static async deleteReport(reportId: string, userId: string) {
        const report = await prisma.report.findUnique({
            where: { id: reportId }
        });

        if (!report) throw new Error("REPORT_NOT_FOUND");

        // Check if user is admin/moderator of the community
        const membership = await prisma.communityMember.findUnique({
            where: {
                userId_communityId: { userId, communityId: report.communityId }
            }
        });

        if (!membership) throw new Error("NOT_A_MEMBER");
        if (membership.role !== "ADMIN" && membership.role !== "MODERATOR") {
            throw new Error("NOT_AUTHORIZED");
        }

        await prisma.report.delete({
            where: { id: reportId }
        });

        return { success: true };
    }
}