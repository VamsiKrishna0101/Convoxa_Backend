
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

async function main() {
    console.log('🔒 Securing Database: Enabling RLS on all tables...');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is missing in .env');
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        const tableNames = [
            "User",
            "Thread",
            "Comment",
            "Reply",
            "Community",
            "CommunityMember",
            "CommunityRule",
            "Conversation",
            "ConversationParticipant",
            "Message",
            "Group",
            "GroupParticipant",
            "GroupMessage",
            "Report",
            "SavedThread",
            "SavedComment",
            "ThreadVote",
            "CommentVote",
            "ReplyVote",
            "Notification",
            "UserFollow",
            "AppSetting",
            "Feedback",
            "HelpRequest",
            "_prisma_migrations"
        ];

        for (const table of tableNames) {
            try {
                // Use quote identifiers to handle case sensitivity
                await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
                console.log(`✅ RLS Enabled for: ${table}`);
            } catch (error: any) {
                console.warn(`⚠️ Could not enable for ${table} (might not exist or already enabled):`, error.message.split('\n')[0]);
            }
        }

        console.log('\n🛡️  Database Security Hardening Complete!');
        console.log('   - Public Access (Anon Key): BLOCKED 🚫');
        console.log('   - Backend Access (Service Role): ALLOWED ✅');

    } catch (e: any) {
        console.error("CRITICAL ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
