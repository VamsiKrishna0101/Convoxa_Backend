export type ProfileOutput = {
    id: string
    username: string
    email: string
    role: string
    createdAt: Date
    followersCount: number
    followingCount: number
    isFollowing?: boolean
    conversationStatus?: string
    conversationId?: string
    initiatorId?: string | null
    withdrawnAt?: Date | null
    threads: UserThreadOutput[]
    comments: UserCommentOutput[]
}

export type UserCommentOutput = {
    id: string
    content: string
    threadId: string
    createdAt: Date
    upvotes: number
}

export type UserThreadOutput = {
    id: string
    title: string
    content: string
    upvotes: number
    communityId: string
    createdAt: Date
    communityName: string
    avatarConfig?: any
    author?: {
        username: string
        avatarConfig?: any
    }
}

export type UserReplyOutput = {
    id: string
    content: string
    commentId: string
    createdAt: Date
}

export type UserCommunityOutput = {
    id: string
    name: string
    description: string
    imageUrl: string
    role: string
    joinedAt: Date
}

export type UserBasicInfo = {
    id: string
    username: string
    imageUrl?: string | null
}
