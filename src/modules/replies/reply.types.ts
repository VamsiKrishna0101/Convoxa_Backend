export type ReplyInput = {
    commentId: string
    content: string
    parentId?: string | null  // null/undefined = top-level reply to comment, else reply to another reply
    imageUrl?: string | null  // For GIF/image support
    isAnonymous?: boolean
}

export type ReplyOutput = Readonly<{
    id: string
    content: string
    username: string | null
    commentId: string
    authorId: string
    parentId: string | null
    path: string
    depth: number
    isAnonymous: boolean
    isOwner: boolean
    isDeleted: boolean
    deletedAt: string | null
    createdAt: string
    updatedAt: string
    upvotes: number
    downvotes: number
    netVotes: number
    userVote?: "UP" | "DOWN" | null
    hasVoted?: "UP" | "DOWN" | null
    imageUrl?: string | null  // For GIF/image support
    avatarConfig?: any
    children: ReplyOutput[]
}>

export type EditReplyInput = {
    replyId: string
    content: string
}

export type DeleteReplyInput = {
    replyId: string
}
