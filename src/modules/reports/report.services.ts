
import prisma from "../../config/prisma";
import type { Prisma } from "@prisma/client";

export interface CreateReportInput {
    reason: string;
    description?: string;

    // Target IDs (one required)
    threadId?: string;
    commentId?: string;
    replyId?: string;
    reportedUserId?: string;

    communityId?: string; // Optional context for community-specific rules
    ruleId?: string;
}

export class ReportService {

    static async createReport(input: CreateReportInput, reporterId: string) {
        const {
            reason,
            description,
            threadId,
            commentId,
            replyId,
            reportedUserId,
            communityId,
            ruleId
        } = input;

        // Ensure at least one target is provided
        if (!threadId && !commentId && !replyId && !reportedUserId) {
            throw new Error("TARGET_REQUIRED");
        }

        const report = await prisma.report.create({
            data: {
                reason,
                description: description || null, // Ensure compatibility with Prisma nullable
                reporterId,
                threadId,
                commentId,
                replyId,
                reportedUserId,
                communityId,
                ruleId,
                status: "PENDING"
            }
        });

        return report;
    }
}
