"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// prisma/seed.ts
var import_client = require("@prisma/client");
var import_faker = require("@faker-js/faker");
var import_bcrypt = __toESM(require("bcrypt"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var SALT_ROUNDS = 10;
var PASSWORD_PLAIN = "password";
var VALID_AVATAR_STYLES = [
  "avataaars",
  "bottts",
  "pixelArt",
  "thumbs",
  "adventurer",
  "funEmoji",
  "croodles",
  "personas"
];
async function main() {
  console.log("DEBUG: STARTING MAIN");
  console.log("DEBUG: DATABASE_URL is " + (process.env.DATABASE_URL ? "PRESENT" : "MISSING"));
  if (process.env.DATABASE_URL) {
    console.log("DEBUG: DB URL starts with: " + process.env.DATABASE_URL.substring(0, 15) + "...");
  }
  let prisma = null;
  try {
    console.log("DEBUG: Init PrismaClient");
    prisma = new import_client.PrismaClient();
    console.log("\u{1F331} Starting database seed...");
    const passwordHash = await import_bcrypt.default.hash(PASSWORD_PLAIN, SALT_ROUNDS);
    const users = [];
    console.log("\u{1F464} Creating 50 users...");
    for (let i = 0; i < 50; i++) {
      const firstName = import_faker.faker.person.firstName();
      const lastName = import_faker.faker.person.lastName();
      const username = import_faker.faker.internet.username({ firstName, lastName }) + i;
      const email = import_faker.faker.internet.email({ firstName, lastName, provider: "example.com" });
      const avatarStyle = import_faker.faker.helpers.arrayElement(VALID_AVATAR_STYLES);
      const avatarConfig = { style: avatarStyle, options: { seed: username } };
      const user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          role: import_client.UserRole.USER,
          isProfileComplete: true,
          avatarConfig
        }
      });
      users.push(user);
    }
    const communities = [];
    console.log("\u{1F3D9}\uFE0F Creating 15 communities...");
    const topics = Object.values(import_client.CommunityTopic);
    for (let i = 0; i < 15; i++) {
      const name = import_faker.faker.word.adjective() + " " + import_faker.faker.word.noun();
      const communityName = name.replace(/\w\S*/g, (w) => w.replace(/^\w/, (c) => c.toUpperCase()));
      const owner = users[Math.floor(Math.random() * users.length)];
      try {
        const community = await prisma.community.create({
          data: {
            name: communityName,
            description: import_faker.faker.lorem.sentence(),
            topic: import_faker.faker.helpers.arrayElement(topics),
            creatorId: owner.id,
            members: { create: { userId: owner.id, role: "ADMIN" } }
          }
        });
        communities.push(community);
      } catch (e) {
        console.warn("Skipping duplicate community name: " + communityName);
      }
    }
    console.log("\u{1F4DD} Generating threads, comments, and votes...");
    for (const user of users) {
      const numCommunities = import_faker.faker.number.int({ min: 2, max: 5 });
      const joinedCommunities = import_faker.faker.helpers.arrayElements(communities, numCommunities);
      for (const community of joinedCommunities) {
        const isMember = await prisma.communityMember.findFirst({
          where: { communityId: community.id, userId: user.id }
        });
        if (!isMember) {
          await prisma.communityMember.create({
            data: { communityId: community.id, userId: user.id, role: "MEMBER" }
          });
        }
        for (let k = 0; k < 5; k++) {
          const isHot = import_faker.faker.datatype.boolean({ probability: 0.2 });
          const thread = await prisma.thread.create({
            data: {
              title: import_faker.faker.lorem.sentence({ min: 3, max: 8 }).slice(0, -1),
              content: import_faker.faker.lorem.paragraph(),
              communityId: community.id,
              ownerId: user.id,
              communityName: community.name,
              createdAt: import_faker.faker.date.recent({ days: 7 }),
              upvotes: isHot ? import_faker.faker.number.int({ min: 50, max: 500 }) : import_faker.faker.number.int({ min: 0, max: 20 }),
              downvotes: import_faker.faker.number.int({ min: 0, max: 5 })
            }
          });
          const numComments = isHot ? import_faker.faker.number.int({ min: 10, max: 30 }) : import_faker.faker.number.int({ min: 0, max: 3 });
          for (let c = 0; c < numComments; c++) {
            const commenter = users[Math.floor(Math.random() * users.length)];
            await prisma.comment.create({
              data: {
                content: import_faker.faker.lorem.sentence(),
                threadId: thread.id,
                authorId: commenter.id,
                createdAt: import_faker.faker.date.recent({ days: 7, refDate: thread.createdAt })
              }
            });
          }
        }
      }
    }
    console.log("\u2705 Seeding completed!");
  } catch (e) {
    console.error("SEED CRITICAL ERROR:");
    console.error(e.message);
    console.error(e);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}
main();
