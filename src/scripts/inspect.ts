
import prisma from '../config/prisma.js';
import fs from 'fs';
import path from 'path';

async function main() {
    try {
        const users = await prisma.user.count();
        const communities = await prisma.community.count();
        const threads = await prisma.thread.count();
        const comments = await prisma.comment.count();

        const result = {
            users,
            communities,
            threads,
            comments,
            timestamp: new Date().toISOString()
        };

        console.log('--- DB INSPECTION ---');
        console.log(JSON.stringify(result, null, 2));

        fs.writeFileSync('inspection_result.json', JSON.stringify(result, null, 2));

    } catch (e) {
        console.error(e);
        fs.writeFileSync('inspection_error.txt', String(e));
    } finally {
        await prisma.$disconnect();
    }
}

main();
