export type CommentInput = {
    threadId: string
    content: string
    imageUrl?: string | null  // For GIF/image support
    isAnonymous?: boolean
}

export type CommentOutput = Readonly<{
    id: string
    content: string
    username: string
    threadId: string
    authorId: string
    isAnonymous: boolean
    isDeleted?: boolean
    deletedAt?: string | null
    createdAt: string
    updatedAt: string
    upvotes: number
    downvotes: number
    netVotes: number
    userVote?: "UP" | "DOWN" | null
    hasVoted?: "UP" | "DOWN" | null
    imageUrl?: string | null  // For GIF/image support
    avatarConfig?: any
}>

export type EditCommentInput = {
    commentId: string
    content: string
}

export type DeleteCommentInput = {
    commentId: string
}
