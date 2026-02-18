
import { HomeFeedService } from './src/modules/homeFeed/homefeed.services';
import { ThreadService } from './src/modules/threads/thread.services';
import prisma from './src/config/prisma';

async function verify() {
    console.log("Starting Verification...");

    // 1. Setup Data
    const user = await prisma.user.findFirst();
    const community = await prisma.community.findFirst();

    if (!user || !community) {
        console.error("No user or community found. Run seed first.");
        return;
    }

    console.log(`Using User: ${user.username}, Community: ${community.name}`);

    // Create a new thread to ensure fresh content
    console.log("Creating new thread...");
    const thread = await ThreadService.createThread({
        title: "Test Composite " + Date.now(),
        content: "Content",
        communityId: community.id
    }, user.id);

    console.log("Thread Created:", thread.id);

    // Test Pagination
    console.log("Testing Home Feed Pagination (NEW - Mixed 70/20/10)...");

    // Page 1
    const page1 = await HomeFeedService.getHomeFeed(user.id, undefined, 10, 'NEW');
    console.log(`Page 1 returned ${page1.data.length} items. Next Cursor: ${page1.nextCursor || "NULL"}`);

    // Decode cursor to verify structure
    if (page1.nextCursor) {
        const decoded = Buffer.from(page1.nextCursor, 'base64').toString('utf-8');
        console.log("Cursor Structure:", decoded);
    }

    if (page1.nextCursor) {
        // Page 2
        console.log("Fetching Page 2 with Composite Cursor...");
        const page2 = await HomeFeedService.getHomeFeed(user.id, page1.nextCursor, 10, 'NEW');
        console.log(`Page 2 returned ${page2.data.length} items.`);

        if (page2.data.length > 0 && page1.data.some(d => d.id === page2.data[0].id)) {
            console.error("FAILED: Duplicate item in page 2");
        }
    } else {
        console.log("No next page (expected if dataset small).");
    }

    console.log("Verification Complete.");
}

verify().catch(console.error).finally(() => prisma.$disconnect());
