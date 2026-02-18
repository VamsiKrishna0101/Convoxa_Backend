
import { ThreadService } from "../modules/threads/thread.services";
import { CommentService } from "../modules/comments/comments.services";
import { ReplyService } from "../modules/replies/reply.services";
import prisma from "../config/prisma";

async function main() {
    console.log("🚀 Starting Soft Delete Verification...");

    try {
        // 1. Setup User & Community
        console.log("1️⃣ Setting up User & Community...");
        const user = await prisma.user.create({
            data: {
                email: `test_${Date.now()}@example.com`,
                username: `testuser_${Date.now()}`,
                passwordHash: "dummyhash"
            }
        });

        const community = await prisma.community.create({
            data: {
                name: `TestCommunity_${Date.now()}`,
                description: "Test Desc",
                topic: "TECHNOLOGY", // Valid enum
                ownerId: user.id
            }
        });

        await prisma.communityMember.create({
            data: {
                userId: user.id,
                communityId: community.id,
                role: "ADMIN",
                username: user.username
            }
        });

        // 2. Create Thread
        console.log("2️⃣ Creating Thread...");
        const thread = await ThreadService.createThread({
            title: "Original Title",
            content: "Original Content",
            communityId: community.id
        }, user.id);

        console.log(`   Thread Created: ${thread.id}`);

        // 3. Create Comment
        console.log("3️⃣ Creating Comment...");
        const comment = await CommentService.createComment({
            threadId: thread.id,
            content: "Original Comment Content"
        }, user.id);
        console.log(`   Comment Created: ${comment.id}`);

        // 4. Create Reply
        console.log("4️⃣ Creating Reply...");
        const reply = await ReplyService.createReply({
            commentId: comment.id,
            content: "Original Reply Content"
        }, user.id);
        console.log(`   Reply Created: ${reply.id}`);

        // 5. Soft Delete Reply
        console.log("5️⃣ Soft Deleting Reply...");
        await ReplyService.deleteReply({ replyId: reply.id }, user.id);
        const deletedReply = await prisma.reply.findUnique({ where: { id: reply.id } });
        console.log("   Deleted Reply:", deletedReply);

        if (!deletedReply?.isDeleted) throw new Error("Reply isDeleted should be true");
        if (deletedReply?.content !== "[deleted]") throw new Error("Reply content should be [deleted]");
        // Reply username null check? Logic says null.
        if (deletedReply?.username !== null) console.warn("Reply username is not null (check implementation)");

        // 6. Soft Delete Comment
        console.log("6️⃣ Soft Deleting Comment...");
        await CommentService.deleteComment({ commentId: comment.id }, user.id);
        const deletedComment = await prisma.comment.findUnique({ where: { id: comment.id } });
        console.log("   Deleted Comment:", deletedComment);

        if (!deletedComment?.isDeleted) throw new Error("Comment isDeleted should be true");
        if (deletedComment?.content !== "[deleted]") throw new Error("Comment content should be [deleted]");
        if (deletedComment?.username !== "deleted") throw new Error(`Comment username should be 'deleted', got '${deletedComment?.username}'`);

        // 7. Soft Delete Thread
        console.log("7️⃣ Soft Deleting Thread...");
        await ThreadService.deleteThread(thread.id, user.id);
        const deletedThread = await prisma.thread.findUnique({ where: { id: thread.id } });
        console.log("   Deleted Thread:", deletedThread);

        if (!deletedThread?.isDeleted) throw new Error("Thread isDeleted should be true");
        if (deletedThread?.title !== "[deleted]") throw new Error("Thread title should be [deleted]");
        if (deletedThread?.content !== "[deleted]") throw new Error("Thread content should be [deleted]");
        if (deletedThread?.username !== "deleted") throw new Error(`Thread username should be 'deleted', got '${deletedThread?.username}'`);

        console.log("✅ VERIFICATION SUCCESSFUL!");

    } catch (e) {
        console.error("❌ VERIFICATION FAILED:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
