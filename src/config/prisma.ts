import { PrismaClient } from "@prisma/client";
import { Pool } from 'pg'
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env.js";

const pool = new Pool({
    connectionString: env.DATABASE_URL,
});

// Debug: Log the DB host to confirm connection
try {
    const dbUrl = new URL(env.DATABASE_URL);
    console.log(`🔌 Connecting to Database Host: ${dbUrl.hostname}`);
} catch (e) {
    console.log("🔌 Connecting to Database (URL parsing failed)");
}

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
});

export default prisma;
