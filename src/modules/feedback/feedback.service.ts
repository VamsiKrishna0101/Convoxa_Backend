import prisma from "../../config/prisma";

export interface FeedbackInput {
    userId: string;
    content: string;
    category?: string;
    rating?: number;
    username?: string;
}

export class FeedbackService {
    static async submitFeedback(data: FeedbackInput) {
        return await prisma.feedback.create({
            data: {
                userId: data.userId,
                content: data.content,
                category: data.category || "GENERAL",
                rating: data.rating,
                username: data.username
            }
        });
    }

    static async getAllFeedback() {
        return await prisma.feedback.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }
}
