import { NotificationType, NotificationStatus } from "@prisma/client";

export type NotificationCreateInput = {
    content: string;
    type: NotificationType;
    status: NotificationStatus;
    receiverId: string;
    senderId?: string;
    threadId?: string;
    commentId?: string;
    replyId?: string;
};
