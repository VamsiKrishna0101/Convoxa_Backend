
export class ScoreService {
    // Reddit's algorithm constants
    // T = (up - down) ...
    // we use a simplified version: (upvotes - downvotes) + (seconds_since_epoch / 45000)

    // 45000 seconds = ~12.5 hours. This means a post needs 10 net upvotes to beat a post that is 12.5 hours newer (raw score wise, very roughly).
    // Actually in the log10 version it's different.
    // Let's use the standard approximated formula:
    // Score = (Order + Sign * Seconds / 45000)
    // Where Order = log10(max(abs(score), 1))

    static calculateHotScore(upvotes: number, downvotes: number, createdAt: Date, commentsCount: number = 0): number {
        // Smart ranking: Upvotes - Downvotes + (Comments * 2) 
        // We give comments double weight as they indicate high engagement
        const score = (upvotes - downvotes) + (commentsCount * 2);

        const order = Math.log10(Math.max(Math.abs(score), 1));

        let sign = 0;
        if (score > 0) sign = 1;
        if (score < 0) sign = -1;

        // Epoch seconds
        const seconds = createdAt.getTime() / 1000;

        // 45000 is the decay constant used by Reddit
        return Math.round((order + sign * seconds / 45000) * 10000000) / 10000000;
    }
}
