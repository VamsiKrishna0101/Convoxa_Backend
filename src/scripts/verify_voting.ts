
import prisma from "../config/prisma.js";
import { CommentService } from "../modules/comments/comments.services.js";
import { ReplyService } from "../modules/replies/reply.services.js";

async function main() {
    console.log("Starting Voting Verification...");

    // 1. Create a User
    const user = await prisma.user.create({
        data: {
            email: `testvote_${Date.now()}@example.com`,
            username: `voteuser_${Date.now()}`,
            passwordHash: "dummyhash",
        },
    });
    console.log("User created:", user.id);

    // 2. Create Community
    const community = await prisma.community.create({
        data: {
            name: `votecomm_${Date.now()}`,
            description: "Test Community",
            ownerId: user.id,
            topic: "TECHNOLOGY",
            imageUrl: "https://example.com/image.png"
        }
    });

    // 3. Add Member
    await prisma.communityMember.create({
        data: {
            userId: user.id,
            communityId: community.id,
            role: "ADMIN",
            username: user.username
        }
    });

    // 4. Create Thread
    const thread = await prisma.thread.create({
        data: {
            title: "Vote Test Thread",
            content: "Content",
            communityId: community.id,
            authorId: user.id,
            username: user.username,
            communityName: community.name
        }
    });

    // 5. Create Comment
    const comment = await CommentService.createComment({
        threadId: thread.id,
        content: "Test Comment"
    }, user.id);
    console.log("Comment created:", comment.id);

    // 6. Upvote Comment
    console.log("Upvoting comment...");
    await CommentService.voteComment(comment.id, user.id, "UP");

    const updatedComment = await prisma.comment.findUnique({ where: { id: comment.id } });
    if (updatedComment?.upvotes !== 1) throw new Error(`Expected 1 upvote, got ${updatedComment?.upvotes}`);
    console.log("Comment Upvote Verified: 1");

    // 7. Create Reply
    const reply = await ReplyService.createReply({
        commentId: comment.id,
        content: "Test Reply"
    }, user.id);
    console.log("Reply created:", reply.id);

    // 8. Downvote Reply
    console.log("Downvoting reply...");
    await ReplyService.voteReply(reply.id, user.id, "DOWN");

    const updatedReply = await prisma.reply.findUnique({ where: { id: reply.id } });
    if (updatedReply?.downvotes !== 1) throw new Error(`Expected 1 downvote, got ${updatedReply?.downvotes}`);
    console.log("Reply Downvote Verified: 1");

    // 9. Remove Vote Reply
    console.log("Removing reply vote...");
    await ReplyService.removeVote(reply.id, user.id);
    const resetReply = await prisma.reply.findUnique({ where: { id: reply.id } });
    if (resetReply?.downvotes !== 0) throw new Error(`Expected 0 downvotes, got ${resetReply?.downvotes}`);
    console.log("Reply Vote Removal Verified: 0");

    console.log("ALL CHECKS PASSED");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
