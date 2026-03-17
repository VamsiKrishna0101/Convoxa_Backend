export type ThreadInput = {
    title: string,
    content: string,
    communityId: string,
    imageUrl?: string,  // Optional image URL from GCS
    isFlagged?: boolean,
    isAnonymous?: boolean,
    isNSFW?: boolean,
}

export type ThreadOutput = Readonly<{
    id: string;
    title: string;
    content: string;
    imageUrl?: string;  // Optional thread image URL
    upvotes: number;
    downvotes: number;
    netVotes: number;
    hasVoted: "UP" | "DOWN" | null;  // Current user's vote
    isSaved: boolean;  // Whether current user has saved this thread
    commentsCount: number;  // Total number of comments
    username: string;
    communityName: string;
    communityId: string;
    communityImageUrl: string;  // Community's image URL
    authorId: string;
    isAnonymous: boolean;
    isNSFW: boolean;
    isOwner: boolean;
    allowAnonymous?: boolean;
    avatarConfig?: any;
    isDeleted?: boolean;
    deletedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}>;

export type VoteInput = {
    threadId: string;
    type: "UP" | "DOWN";
}
