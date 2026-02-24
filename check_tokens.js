const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    const users = await prisma.user.findMany({
        take: 5,
        select: { id: true, username: true, expopushtoken: true }
    });
    console.log(users);
}

main().catch(console.error).finally(() => process.exit(0));
