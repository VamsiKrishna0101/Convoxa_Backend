import prisma from "../../config/prisma.js";

export class HelpService {
    static async submitRequest(email: string, content: string, userId?: string) {
        return await prisma.helpRequest.create({
            data: {
                email,
                content,
                status: "PENDING",
                userId
            }
        });
    }

    static async getRequestsByUser(userId: string) {
        return await prisma.helpRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async getAllRequests() {
        return await prisma.helpRequest.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }

    static async updateRequestStatus(id: string, status: string) {
        return await prisma.helpRequest.update({
            where: { id },
            data: { status }
        });
    }
}
