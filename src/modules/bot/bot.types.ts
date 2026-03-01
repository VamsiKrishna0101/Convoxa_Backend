export type BotJobType = 'COMMENT_ON_THREAD';

export interface CommentOnThreadPayload {
    threadId: string;
}

export interface BotJobPayload extends CommentOnThreadPayload {
    type: BotJobType;
}
