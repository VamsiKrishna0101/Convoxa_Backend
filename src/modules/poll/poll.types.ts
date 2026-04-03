export type PollInput = {
    question: string;
    options: string[];
    communityId: string;
    content: string;
    isAnonymous: boolean;
};

export type VoteInput = {
    pollId: string;
    optionId: string;
};