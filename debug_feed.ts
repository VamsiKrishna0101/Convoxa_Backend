
import prisma from "./src/config/prisma";
import { HomeFeedService } from "./src/modules/homeFeed/homefeed.services";

async function main() {
    try {
        console.log("--- DEBUGGER START ---");

        // 1. Check DB Counts
        const userCount = await prisma.user.count();
        const threadCount = await prisma.thread.count();
        const communityCount = await prisma.community.count();

        console.log(`Users: ${userCount}`);
        console.log(`Threads: ${threadCount}`);
        console.log(`Communities: ${communityCount}`);

        if (threadCount === 0) {
            console.log("⚠️ DB is empty of threads. Feed will be empty.");
            return;
        }

        // 2. Get a User (Assuming we have one, or use the first one)
        const user = await prisma.user.findFirst();
        if (!user) {
            console.log("No users found.");
            return;
        }
        console.log(`Testing with User: ${user.username} (${user.id})`);

        // 3. Call Service
        console.log("Calling HomeFeedService.getHomeFeed...");
        const feed = await HomeFeedService.getHomeFeed(user.id, undefined, 20, 'NEW');

        console.log(`Feed Result Type: ${typeof feed}`);
        if (feed && feed.data) {
            console.log(`Feed items: ${feed.data.length}`);
            feed.data.forEach((t, i) => {
                console.log(`[${i}] ${t.title} (Comm: ${t.communityName}, Auth: ${t.username})`);
            });
            console.log(`Next Cursor: ${feed.nextCursor}`);
        } else {
            console.log("Feed returned no data structure/null?");
        }

    } catch (e: any) {
        console.error("DEBUG ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
