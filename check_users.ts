import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    console.log("Checking users...");
    const users = await prisma.user.findMany({
        take: 10,
        select: {
            id: true,
            email: true,
            username: true,
            isProfileComplete: true
        }
    });

    console.table(users);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
