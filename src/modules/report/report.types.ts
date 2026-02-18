export type ReportInput = {
    communityId: string;
    threadId?: string;
    commentId?: string;
    replyId?: string;
    ruleId?: string;
    reason?: string;
};

export type ReportOutput = Readonly<{
    id: string;
    reporterId: string;
    communityId: string;
    threadId?: string;
    commentId?: string;
    replyId?: string;
    ruleId?: string;
    reason?: string;
    createdAt: string;
}>;