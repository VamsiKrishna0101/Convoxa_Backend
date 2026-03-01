
import { HomeFeedService } from "./src/modules/homeFeed/homefeed.services";
import prisma from "./src/config/prisma";

async function main() {
    console.log("Starting Debugging...");

    // 1. Get a valid user
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error("No user found in DB");
        return;
    }
    console.log("Using User:", user.id, user.username);

    // 2. Test HOT
    try {
        console.log("Testing HOT...");
        const resHot = await HomeFeedService.getHomeFeed(user.id, undefined, 20, 'HOT');
        console.log("HOT Success. Items:", resHot.data.length);
    } catch (e) {
        console.error("HOT Failed:", e);
    }

    // 3. Test NEW
    try {
        console.log("Testing NEW...");
        const resNew = await HomeFeedService.getHomeFeed(user.id, undefined, 20, 'NEW');
        console.log("NEW Success. Items:", resNew.data.length);
    } catch (e) {
        console.error("NEW Failed:", e);
    }

    // 4. Test TOP
    try {
        console.log("Testing TOP...");
        const resTop = await HomeFeedService.getHomeFeed(user.id, undefined, 20, 'TOP');
        console.log("TOP Success. Items:", resTop.data.length);
    } catch (e) {
        console.error("TOP Failed:", e);
    }

    // 5. Test Caching (Call Trending again)
    try {
        console.log("Testing Cache Hit (HOT again)...");
        const resHot2 = await HomeFeedService.getHomeFeed(user.id, undefined, 20, 'HOT');
        console.log("HOT Cache Hit Success. Items:", resHot2.data.length);
    } catch (e) {
        console.error("HOT Cache Hit Failed:", e);
    }

}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
