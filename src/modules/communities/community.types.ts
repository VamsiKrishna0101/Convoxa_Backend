export type CommunityInput = {
    name: string;
    description: string;
    topic: "ANIME_AND_COSPLAY" | "ART" | "BUSINESS_AND_FINANCE" | "COLLECTIBLES_AND_OTHER_HOBBIES" |
    "EDUCATION_AND_CAREER" | "FASHION_AND_BEAUTY" | "FOOD_AND_DRINKS" | "GAMES" | "HEALTH" |
    "HOME_AND_GARDEN" | "HUMANITIES_AND_LAW" | "IDENTITY_AND_RELATIONSHIPS" | "INTERNET_CULTURE" |
    "MOVIES_AND_TV" | "MUSIC" | "NATURE_AND_OUTDOORS" | "NEWS_AND_POLITICS" | "PLACES_AND_TRAVEL" |
    "POP_CULTURE" | "QAS_AND_STORIES" | "READING_AND_WRITING" | "SCIENCES" | "SPOOKY" | "SPORTS" |
    "TECHNOLOGY" | "VEHICLES" | "WELLNESS" | "ADULT_CONTENT" | "MATURE_TOPICS";
    visibility?: "PUBLIC" | "PRIVATE";
    allowAnonymous?: boolean;
    imageUrl: string; // Required for community creation
};

export type CommunityOutput = Readonly<{
    id: string;
    name: string;
    description: string;
    topic: string;
    visibility: "PUBLIC" | "PRIVATE";
    allowAnonymous: boolean;
    joinCode?: string | null;
    imageUrl: string;
    isDeleted?: boolean;
    deletedAt?: string | null;
}>;

export type CommunityRuleInput = {
    title: string;
    description?: string;
    order: number;
    communityId: string;
    keywords?: string[];
    appliesTo?: "POST" | "COMMENT" | "BOTH";
};

export type CommunityRuleOutput = Readonly<{
    id: string;
    title: string;
    description?: string;
    order: number;
    communityId: string;
    keywords: string[];
    appliesTo: "POST" | "COMMENT" | "BOTH";
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}>;
