
import { UserRole, CommunityTopic } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';

const SALT_ROUNDS = 10;
const PASSWORD_PLAIN = 'password';

const VALID_AVATAR_STYLES = [
    'avataaars', 'bottts', 'pixelArt', 'thumbs', 'adventurer', 'funEmoji', 'croodles', 'personas'
];

async function main() {
    console.log('🌱 Starting database seed (via src/scripts)...');

    try {
        // 1. Prepare Password Hash
        const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, SALT_ROUNDS);

        // 3. Create 50 Users
        const users = [];
        console.log('👤 Creating 50 users...');

        for (let i = 0; i < 50; i++) {
            const firstName = faker.person.firstName();
            const lastName = faker.person.lastName();
            const username = faker.internet.username({ firstName, lastName }) + i;
            const email = faker.internet.email({ firstName, lastName, provider: 'example.com' });

            const avatarStyle = faker.helpers.arrayElement(VALID_AVATAR_STYLES);
            const avatarConfig = { style: avatarStyle, options: { seed: username } };

            try {
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
            } catch (e: any) {
                if (e.code !== 'P2002') console.error(e);
            }
        }

        if (users.length === 0) {
            const existingUsers = await prisma.user.findMany({ take: 50 });
            users.push(...existingUsers);
        }

        // 4. Create 15 Communities
        const communities = [];
        const topics = Object.values(CommunityTopic);

        console.log('🏙️ Creating 15 communities...');
        for (let i = 0; i < 15; i++) {
            const name = faker.word.adjective() + ' ' + faker.word.noun();
            const communityName = name.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
            const owner = users[Math.floor(Math.random() * users.length)];

            try {
                const community = await prisma.community.create({
                    data: {
                        name: communityName,
                        description: faker.lorem.sentence(),
                        imageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(communityName)}&background=random`,
                        topic: faker.helpers.arrayElement(topics),
                        ownerId: owner.id, // CORRECT: ownerId
                        members: {
                            create: {
                                userId: owner.id,
                                role: 'ADMIN',
                                username: owner.username // Validated
                            }
                        }
                    }
                });
                communities.push(community);
            } catch (e: any) {
                if (e.code !== 'P2002') {
                    console.error('Failed to create community: ' + communityName);
                    console.error(e);
                }
            }
        }

        if (communities.length === 0) {
            const existingCommunities = await prisma.community.findMany({ take: 15 });
            communities.push(...existingCommunities);
        }

        // If still 0, stop
        if (communities.length === 0) {
            console.error("❌ No communities created or found. Aborting threads.");
            return;
        }

        // 5. Engagement
        console.log('📝 Generating engagement...');
        for (const user of users) {
            const numCommunities = faker.number.int({ min: 2, max: 5 });
            const joinedCommunities = faker.helpers.arrayElements(communities, numCommunities);

            for (const community of joinedCommunities) {
                const isMember = await prisma.communityMember.findFirst({
                    where: { communityId: community.id, userId: user.id }
                });

                if (!isMember) {
                    await prisma.communityMember.create({
                        data: {
                            communityId: community.id,
                            userId: user.id,
                            role: 'MEMBER',
                            username: user.username // Validated
                        }
                    });
                }

                for (let k = 0; k < 5; k++) {
                    const isHot = faker.datatype.boolean({ probability: 0.2 });

                    const thread = await prisma.thread.create({
                        data: {
                            title: faker.lorem.sentence({ min: 3, max: 8 }).slice(0, -1),
                            content: faker.lorem.paragraph(),
                            communityId: community.id,
                            authorId: user.id, // CORRECT: authorId
                            communityName: community.name, // Validated
                            username: user.username, // Validated
                            createdAt: faker.date.recent({ days: 7 }),
                            upvotes: isHot ? faker.number.int({ min: 50, max: 500 }) : faker.number.int({ min: 0, max: 20 }),
                            downvotes: faker.number.int({ min: 0, max: 5 }),
                            commentsCount: 0
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
                                username: commenter.username, // Validated
                                createdAt: faker.date.recent({ days: 7, refDate: thread.createdAt })
                            }
                        });
                        // Update thread comment count (optional but good)
                    }
                }
            }
        }

        console.log('✅ Seeding completed!');

    } catch (e: any) {
        console.error("SEED FAIL:");
        console.error(e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
