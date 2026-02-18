
export type MakeModInput = {
    targetUserId: string;
    communityId: string;
}

export type AdminCommunityOutput = {
    id: string;
    name: string;
    description: string;
    topic: string;
    visibility: string;
    imageUrl: string | null;
    memberCount?: number;
}
