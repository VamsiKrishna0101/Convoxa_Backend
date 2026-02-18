
import prisma from "../config/prisma";
import { ProfileService } from "../modules/profile/profile.services";

async function main() {
    console.log("Starting Profile Follow Verification...");

    // 1. Create Test Users
    const userA = await prisma.user.create({
        data: {
            email: `userA_${Date.now()}@test.com`,
            username: `userA_${Date.now()}`,
            passwordHash: "hash"
        }
    });

    const userB = await prisma.user.create({
        data: {
            email: `userB_${Date.now()}@test.com`,
            username: `userB_${Date.now()}`,
            passwordHash: "hash"
        }
    });

    console.log(`Created users: ${userA.username} (A), ${userB.username} (B)`);

    try {
        // 2. User A follows User B
        console.log("User A following User B...");
        await ProfileService.followUser(userA.id, userB.id);

        // 3. Check User A's following list
        console.log("Checking User A's following list...");
        const followingA = await ProfileService.getFollowing(userA.id);
        console.log("User A following:", followingA);
        if (followingA.length !== 1 || followingA[0].id !== userB.id) {
            throw new Error("User A should be following User B");
        }

        // 4. Check User B's followers list
        console.log("Checking User B's followers list...");
        const followersB = await ProfileService.getFollowers(userB.id);
        console.log("User B followers:", followersB);
        if (followersB.length !== 1 || followersB[0].id !== userA.id) {
            throw new Error("User B should be followed by User A");
        }

        // 5. User A unfollows User B
        console.log("User A unfollowing User B...");
        await ProfileService.unfollowUser(userA.id, userB.id);

        // 6. Verify lists are updated
        const followingA_after = await ProfileService.getFollowing(userA.id);
        if (followingA_after.length !== 0) {
            throw new Error("User A should have 0 following after unfollow");
        }
        console.log("Unfollow verified.");

        console.log("✅ All checks passed!");

    } catch (error) {
        console.error("❌ Verification failed:", error);
    } finally {
        // Cleanup
        await prisma.userFollow.deleteMany({
            where: {
                OR: [
                    { followerId: userA.id },
                    { followingId: userA.id },
                    { followerId: userB.id },
                    { followingId: userB.id }
                ]
            }
        });
        await prisma.user.deleteMany({
            where: {
                id: { in: [userA.id, userB.id] }
            }
        });
    }
}

main();
