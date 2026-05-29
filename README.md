# Convoxa Backend

> Production backend for Convoxa — a community discussion platform live on Google Play Store.

[![Node.js](https://img.shields.io/badge/Node.js-TypeScript-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat&logo=express)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-336791?style=flat&logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-BullMQ-DC382D?style=flat&logo=redis)](https://redis.io)
[![GCP](https://img.shields.io/badge/GCP-Cloud_Run-4285F4?style=flat&logo=google-cloud)](https://cloud.google.com/run)

**322 installs · 65 MAU · 1.9M+ API requests · P95 < 200ms @ 500 concurrent users**

---

## What Is Convoxa?

Convoxa is a Reddit-style community discussion platform with threaded posts, nested comments, 3-mode feed ranking, real-time messaging, and an AI chatbot. This repo is the Node.js/TypeScript backend powering the mobile app.

---

## Architecture

```
React Native App (Expo)
        │
        ├── REST API (Express 5)
        │       └── JWT / Google OAuth auth
        │
        ├── WebSocket (Socket.io)
        │       └── Real-time DMs + group chats
        │
        └── BullMQ Job Queues (Redis)
                ├── bot-actions      → Gemini AI bot comments on threads
                ├── notifications    → Expo push notification delivery
                └── ai-replies       → AI-powered reply generation
```

All services run stateless on **GCP Cloud Run** with GitHub Actions CI/CD.

---

## Key Engineering Decisions

**Feed Ranking — 3 modes**
- `NEW` — ordered by `createdAt DESC`
- `HOT` — ordered by `hotScore DESC` (precomputed, decays over time)
- `TOP` — ordered by `upvotes DESC`

Feed is personalized based on joined communities, followed users, and topic overlap. Uses dual-cursor pagination to merge personalized and discovery feeds without repeating items.

**Vote Consistency**
- Denormalised `upvotes`, `downvotes`, `netVotes`, `commentsCount` counters on Thread/Comment — no `COUNT()` on hot read paths
- Server-authoritative vote state with composite unique constraints to prevent double-votes under concurrent traffic

**AI Bot (Convoxa AI)**
- Gemini 2.5 Flash as primary, Gemini 2.5 Flash Lite as fallback
- Bot jobs enqueued to BullMQ `bot-actions` queue asynchronously — never blocks request thread
- Bot user auto-provisioned on first queue worker boot

**Notifications**
- Expo Server SDK for push delivery
- Notification jobs enqueued to BullMQ `notifications` queue with `removeOnComplete: true`
- Supports: thread replies, comment votes, follows, community activity

**Real-time Messaging**
- Socket.io for DMs and group chats
- SQLite offline persistence on client side
- View-once group messages supported

---

## Module Overview

| Module | Responsibility |
|---|---|
| `auth` | JWT auth, Google OAuth, bcrypt password hashing |
| `homeFeed` | Personalized feed with HOT/NEW/TOP ranking + cursor pagination |
| `threads` | Thread CRUD, voting, hotScore updates, polls, NSFW flags, soft delete |
| `comments` | Nested comments, voting, soft delete |
| `replies` | Reply-to-comment with voting |
| `communities` | Create/join/manage communities, roles, rules, visibility, join codes |
| `groups` | Group chats — create, manage participants, view-once messages |
| `chat` | 1:1 DMs — conversation initiation, accept/block, messaging |
| `bot` | Gemini AI bot — auto-comments on threads via BullMQ |
| `notification` | Push notifications via Expo SDK + BullMQ worker |
| `profile` | User profiles, follow/unfollow, avatar config |
| `explore` | Search communities, users, trending threads |
| `saved` | Save/unsave threads and comments |
| `poll` | Poll creation and voting within threads |
| `upload` | Image upload to GCP Cloud Storage via Multer |
| `report` | User-submitted content reports |
| `admin` | Admin controls — moderation, user management |
| `appSettings` | App-level config (maintenance mode, feature flags) |
| `feedback` | In-app feedback submission |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript (ESM) |
| Framework | Express 5 |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Database | PostgreSQL |
| Cache / Queue | Redis (ioredis) + BullMQ |
| Real-time | Socket.io 4 |
| AI | Gemini 2.5 Flash (`@google/generative-ai`) |
| Auth | JWT (jsonwebtoken) + bcrypt + Google OAuth |
| Push Notifications | Expo Server SDK |
| Storage | GCP Cloud Storage (Multer) |
| Firebase | Firebase Admin SDK |
| Deployment | GCP Cloud Run + GitHub Actions CI/CD |

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- GCP project (for Cloud Storage)
- Gemini API key

### Install & Run

```bash
npm install
cp .env.example .env   # fill in your credentials
npx prisma migrate dev
npm run dev            # tsx src/server.ts
```

### Build for Production

```bash
npm run build          # tsc → dist/
npm start              # node dist/server.js
```

### Seed Database

```bash
node prisma/seed.cjs
```

---

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/convoxa
REDIS_URL=redis://localhost:6379
JWT_SECRET=
GEMINI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GCP_BUCKET_NAME=
GCP_PROJECT_ID=
FIREBASE_PROJECT_ID=
```

---

## Data Model (key entities)

- **User** — auth, profile, avatar config, Expo push token, follow graph
- **Community** — topic, visibility (PUBLIC/PRIVATE), join codes, rules, soft delete
- **Thread** — posts with poll support, NSFW flag, anonymous mode, hotScore, denormalised vote counters
- **Comment / Reply** — nested with denormalised counters, soft delete
- **Conversation / Message** — 1:1 DMs with accept/block state
- **Group / GroupMessage** — group chats with view-once message support
- **Notification** — typed notification events with read state
- **SavedThread / SavedComment** — per-user saved items
- **Report** — content moderation reports linked to community rules

---

## Performance

Benchmarked with k6 at 500 concurrent users across 1.9M+ requests:

| Endpoint | RPS | P95 Latency |
|---|---|---|
| Home Feed | 199 | < 200ms |
| Thread | 449 | < 200ms |
| Comments | 336 | < 200ms |
| Conversations | 284 | < 200ms |

---

## License

MIT License
