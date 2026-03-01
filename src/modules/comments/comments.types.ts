export type CommentInput = {
    content: string;
    threadId: string;
};

export type CommentOutput = Readonly<{
    id: string;
    content: string;
    username: string;
    threadId: string;
    authorId: string;
    createdAt: string;
    updatedAt: string;
}>;
