
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const CDN_URL = process.env.CDN_URL;

const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting migration...");

    if (!CDN_URL) {
        console.error("❌ CDN_URL not found in environment");
        return;
    }

    // Remove trailing slash if present
    const baseUrl = CDN_URL.replace(/\/$/, "");
    console.log(`Target CDN: ${baseUrl}`);

    const targetString = "https://storage.googleapis.com";

    // 1. Communities
    try {
        const communities = await prisma.community.findMany({
            where: { imageUrl: { contains: targetString } }
        });
        console.log(`\nFound ${communities.length} communities.`);
        for (const c of communities) {
            const newUrl = c.imageUrl.replace(targetString, baseUrl);
            await prisma.community.update({ where: { id: c.id }, data: { imageUrl: newUrl } });
            process.stdout.write(".");
        }
    } catch (e) {
        console.error("Error updating communities:", e);
    }

    // 2. Threads
    try {
        const threads = await prisma.thread.findMany({
            where: { imageUrl: { contains: targetString } }
        });
        console.log(`\nFound ${threads.length} threads.`);
        for (const t of threads) {
            if (t.imageUrl) {
                const newUrl = t.imageUrl.replace(targetString, baseUrl);
                await prisma.thread.update({ where: { id: t.id }, data: { imageUrl: newUrl } });
                process.stdout.write(".");
            }
        }
    } catch (e) {
        console.error("Error updating threads:", e);
    }

    // 3. Comments
    try {
        const comments = await prisma.comment.findMany({
            where: { imageUrl: { contains: targetString } }
        });
        console.log(`\nFound ${comments.length} comments.`);
        for (const c of comments) {
            if (c.imageUrl) {
                const newUrl = c.imageUrl.replace(targetString, baseUrl);
                await prisma.comment.update({ where: { id: c.id }, data: { imageUrl: newUrl } });
                process.stdout.write(".");
            }
        }
    } catch (e) {
        console.error("Error updating comments:", e);
    }

    // 4. Replies
    try {
        const replies = await prisma.reply.findMany({
            where: { imageUrl: { contains: targetString } }
        });
        console.log(`\nFound ${replies.length} replies.`);
        for (const r of replies) {
            if (r.imageUrl) {
                const newUrl = r.imageUrl.replace(targetString, baseUrl);
                await prisma.reply.update({ where: { id: r.id }, data: { imageUrl: newUrl } });
                process.stdout.write(".");
            }
        }
    } catch (e) {
        console.error("Error updating replies:", e);
    }

    // 5. Groups
    try {
        const groups = await prisma.group.findMany({
            where: { imageUrl: { contains: targetString } }
        });
        console.log(`\nFound ${groups.length} groups.`);
        for (const g of groups) {
            if (g.imageUrl) {
                const newUrl = g.imageUrl.replace(targetString, baseUrl);
                await prisma.group.update({ where: { id: g.id }, data: { imageUrl: newUrl } });
                process.stdout.write(".");
            }
        }
    } catch (e) {
        console.error("Error updating groups:", e);
    }

    // 6. Messages
    try {
        const messages = await prisma.message.findMany({
            where: { mediaUrl: { contains: targetString } }
        });
        console.log(`\nFound ${messages.length} messages.`);
        for (const m of messages) {
            if (m.mediaUrl) {
                const newUrl = m.mediaUrl.replace(targetString, baseUrl);
                await prisma.message.update({ where: { id: m.id }, data: { mediaUrl: newUrl } });
                process.stdout.write(".");
            }
        }
    } catch (e) {
        console.error("Error updating messages:", e);
    }

    console.log("\n✅ Migration complete!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
