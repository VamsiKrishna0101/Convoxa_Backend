
import { PrismaClient } from '@prisma/client';
import { ChatService } from './src/modules/chat/chat.services';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Chat Pagination Verification...");

    // 1. Setup Data
    console.log("Setting up test data...");
    // Create two users
    const user1 = await prisma.user.upsert({
        where: { email: 'chat_test_user1@example.com' },
        update: {},
        create: {
            email: 'chat_test_user1@example.com',
            username: 'chat_test_user1',
            password: 'password123',
            name: 'Chat Test User 1'
        }
    });

    const user2 = await prisma.user.upsert({
        where: { email: 'chat_test_user2@example.com' },
        update: {},
        create: {
            email: 'chat_test_user2@example.com',
            username: 'chat_test_user2',
            password: 'password123',
            name: 'Chat Test User 2'
        }
    });

    console.log(`Users: ${user1.id}, ${user2.id}`);

    // Create a conversation
    let conversation = await prisma.conversation.findFirst({
        where: {
            participants: {
                every: {
                    userId: { in: [user1.id, user2.id] }
                }
            }
        }
    });

    if (!conversation) {
        conversation = await ChatService.createConversation({ targetUserId: user2.id }, user1.id);
    }
    console.log(`Conversation: ${conversation!.id}, Status: ${conversation!.status}`);

    // Accept it to test chat list properly
    if (conversation!.status === 'PENDING') {
        await ChatService.acceptChat(conversation!.id, user2.id);
        console.log("Accepted chat");
    }

    // Send 5 messages
    for (let i = 0; i < 5; i++) {
        await ChatService.sendMessage({
            conversationId: conversation!.id,
            content: `Message ${i}`,
            targetUserId: user2.id,
            type: "TEXT"
        }, user1.id);
        // Small delay to ensure createdAt differs
        await new Promise(r => setTimeout(r, 100));
    }
    console.log("Sent 5 messages");

    // 2. Verify getMessages Pagination
    console.log("\n--- Testing getMessages Pagination ---");
    const limit = 2;
    const page1 = await ChatService.getMessages(conversation!.id, user1.id, undefined, limit);
    console.log(`Page 1 (Limit ${limit}): fetched ${page1.messages.length} messages. Next Cursor: ${page1.nextCursor}`);

    if (page1.messages.length !== limit) {
        console.error(`❌ Expected ${limit} messages, got ${page1.messages.length}`);
    } else {
        console.log("✅ Page 1 length correct");
    }

    if (page1.nextCursor) {
        const page2 = await ChatService.getMessages(conversation!.id, user1.id, page1.nextCursor, limit);
        console.log(`Page 2 (Cursor ${page1.nextCursor}): fetched ${page2.messages.length} messages.`);

        // ensure no overlap/duplicates (basic check)
        const ids1 = page1.messages.map(m => m.id);
        const ids2 = page2.messages.map(m => m.id);
        const hasOverlap = ids1.some(id => ids2.includes(id));
        if (hasOverlap) console.error("❌ Overlap detected between pages");
        else console.log("✅ No overlap between pages");
    } else {
        console.error("❌ Expected nextCursor for page 1");
    }

    // 3. Verify getChatList Pagination
    console.log("\n--- Testing getChatList Pagination ---");
    // Ensure we have at least one other conversation to test pagination if possible
    // For now, testing with 1 item and limit 1 might have nextCursor? No, limit 1 will return 1 item.
    // Loop logic: if length > limit, pop. 
    // If we have 1 conversation, and limit is 1. fetch take: 2. returns 1. length <= limit (1<=1). nextCursor undefined. Correct.
    // If limit is 0?
    // Let's try limit 1.
    const listPage1 = await ChatService.getChatList(user1.id, undefined, 10);
    console.log(`Chat List (Limit 10): fetched ${listPage1.conversations.length} conversations.`);
    if (listPage1.conversations.length > 0) {
        console.log("✅ Chat list fetch successful");
        console.log("Sample Conversation updatedAt:", listPage1.conversations[0].updatedAt);
    } else {
        console.warn("⚠️ Chat list empty (might be valid if clear db)");
    }

    // 4. Verify getChatRequests
    console.log("\n--- Testing getChatRequests Pagination ---");
    // Create a new pending request
    // Need a 3rd user
    const user3 = await prisma.user.upsert({
        where: { email: 'chat_test_user3@example.com' },
        update: {},
        create: {
            email: 'chat_test_user3@example.com',
            username: 'chat_test_user3',
            password: 'password123',
            name: 'Chat Test User 3'
        }
    });

    const reqConv = await ChatService.createConversation({ targetUserId: user1.id }, user3.id); // User3 -> User1
    console.log(`Created request from ${user3.username} to ${user1.username}`);

    const requestsPage = await ChatService.getMyRequests(user1.id, undefined, 5);
    console.log(`Requests (Limit 5): fetched ${requestsPage.requests.length} requests.`);

    const found = requestsPage.requests.find(r => r.id === reqConv.id);
    if (found) console.log("✅ Found newly created request");
    else console.error("❌ Request not found");

    console.log("\nVerification Complete.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
