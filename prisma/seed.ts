
import { PrismaClient, UserRole, CommunityTopic } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { fileURLToPath } from 'url';

dotenv.config();

const SALT_ROUNDS = 10;
const PASSWORD_PLAIN = 'password';

const VALID_AVATAR_STYLES = [
    'avataaars', 'bottts', 'pixelArt', 'thumbs', 'adventurer', 'funEmoji', 'croodles', 'personas'
];

async function main() {
    // console.log('DEBUG: STARTING MAIN');
    // console.log('DEBUG: DATABASE_URL is ' + (process.env.DATABASE_URL ? 'PRESENT' : 'MISSING'));

    let prisma: PrismaClient | null = null;
    try {
        // console.log('DEBUG: Init PrismaClient with Adapter');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
        const adapter = new PrismaPg(pool);
        prisma = new PrismaClient({ adapter });

        // console.log('🌱 Starting database seed...');

        const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, SALT_ROUNDS);

        const users = [];
        // console.log('👤 Creating 50 users...');
        for (let i = 0; i < 50; i++) {
            const firstName = faker.person.firstName();
            const lastName = faker.person.lastName();
            const username = faker.internet.username({ firstName, lastName }) + i;
            const email = faker.internet.email({ firstName, lastName, provider: 'example.com' });

            const avatarStyle = faker.helpers.arrayElement(VALID_AVATAR_STYLES);
            const avatarConfig = { style: avatarStyle, options: { seed: username } };

            const user = await prisma.user.create({
                data: {
                    username,
                    email,
                    passwordHash,
                    role: UserRole.USER,
                    isProfileComplete: true,
                    avatarConfig,
                }
            });
            users.push(user);
        }

        const communities = [];
        // console.log('🏙️ Creating 15 communities...');
        const topics = Object.values(CommunityTopic);
        for (let i = 0; i < 15; i++) {
            const name = faker.word.adjective() + ' ' + faker.word.noun();
            const communityName = name.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
            const owner = users[Math.floor(Math.random() * users.length)];

            // Unique name check? Faker might generate dupes. Prisma will throw.
            // Let's just catch and skip if dupe
            try {
                const community = await prisma.community.create({
                    data: {
                        name: communityName,
                        description: faker.lorem.sentence(),
                        topic: faker.helpers.arrayElement(topics),
                        creatorId: owner.id,
                        members: { create: { userId: owner.id, role: 'ADMIN' } }
                    }
                });
                communities.push(community);
            } catch (e) {
                // console.warn('Skipping duplicate community name: ' + communityName);
            }
        }

        // console.log('📝 Generating threads, comments, and votes...');
        for (const user of users) {
            const numCommunities = faker.number.int({ min: 2, max: 5 });
            const joinedCommunities = faker.helpers.arrayElements(communities, numCommunities);

            for (const community of joinedCommunities) {
                const isMember = await prisma.communityMember.findFirst({
                    where: { communityId: community.id, userId: user.id }
                });

                if (!isMember) {
                    await prisma.communityMember.create({
                        data: { communityId: community.id, userId: user.id, role: 'MEMBER' }
                    });
                }

                for (let k = 0; k < 5; k++) {
                    const isHot = faker.datatype.boolean({ probability: 0.2 });

                    const thread = await prisma.thread.create({
                        data: {
                            title: faker.lorem.sentence({ min: 3, max: 8 }).slice(0, -1),
                            content: faker.lorem.paragraph(),
                            communityId: community.id,
                            ownerId: user.id,
                            communityName: community.name,
                            createdAt: faker.date.recent({ days: 7 }),
                            upvotes: isHot ? faker.number.int({ min: 50, max: 500 }) : faker.number.int({ min: 0, max: 20 }),
                            downvotes: faker.number.int({ min: 0, max: 5 })
                        }
                    });

                    const numComments = isHot ? faker.number.int({ min: 10, max: 30 }) : faker.number.int({ min: 0, max: 3 });
                    for (let c = 0; c < numComments; c++) {
                        const commenter = users[Math.floor(Math.random() * users.length)];
                        await prisma.comment.create({
                            data: {
                                content: faker.lorem.sentence(),
                                threadId: thread.id,
                                authorId: commenter.id,
                                createdAt: faker.date.recent({ days: 7, refDate: thread.createdAt })
                            }
                        });
                    }
                }
            }
        }

        // console.log('✅ Seeding completed!');

    } catch (e: any) {
        // console.error("SEED CRITICAL ERROR:");
        // console.error(e.message);
        // console.error(e);
        // process.exit(1); 
    } finally {
        if (prisma) {
            await prisma.$disconnect();
        }
    }
}

main();
