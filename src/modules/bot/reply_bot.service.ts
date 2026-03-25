import axios from 'axios';
import 'dotenv/config';
import prisma from '../../config/prisma.js';
import { BotService } from './bot.service.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface BotContext {
    threadId: string;
    commentId?: string;
    replyId?: string;
    mentionText: string;
    authorId: string;
}

export class ReplyBotService {
    static async generateResponse(context: BotContext): Promise<string | null> {
        try {
            if (!GROQ_API_KEY) {
                console.error("[ReplyBotService] GROQ_API_KEY is missing!");
                return null;
            }

            // 1. Fetch Thread Context
            const thread = await prisma.thread.findUnique({
                where: { id: context.threadId },
                include: { community: true }
            });
            if (!thread) return null;

            // 2. Build Context Payload
            let contextPayload = `Thread Title: "${thread.title}"\n`;
            if (thread.content) contextPayload += `Thread Description: "${thread.content}"\n`;
            if (thread.imageUrl) contextPayload += `Thread Image: [Image attached]\n`;
            contextPayload += `Community: c/${thread.community.name}\n`;

            if (context.commentId) {
                const comment = await prisma.comment.findUnique({ where: { id: context.commentId } });
                if (comment) contextPayload += `Parent Comment: "${comment.content}"\n`;
            } else if (context.replyId) {
                const reply = await prisma.reply.findUnique({ where: { id: context.replyId } });
                if (reply) contextPayload += `Parent Reply: "${reply.content}"\n`;
            }

            const systemPrompt = `
You are "@convoxaai", a sharp and witty AI living inside Convoxa — a platform for raw, real, trending conversations.

YOUR PERSONALITY:
- Talk like a real person, not a bot.
- Casual, clever, confident. Like that friend who always has the best takes.
- Opinionated when it fits. Don't hedge everything.
- No "Great question!", no "As an AI...", no cringe opener.

STRICT FORMATTING RULES — NEVER BREAK THESE:
- Zero markdown. No **, no *, no ##, no --, no ~~ nothing. Plain text only.
- No bullet points. No numbered lists. Ever.
- If the user asks for recommendations or a list of things (movies, songs, shows, etc.),
  write them inline as a natural sentence like:
  "Go watch The Descent, Just Before Dawn, The Hills Have Eyes, Preservation, and Hatchet — all hit that same vibe."
  NOT as separate lines or bullets.
- Do NOT repeat what the user asked.
- Do NOT start with their name or @convoxaai.
- Do NOT reference the community name at all — skip it entirely.
- Do NOT add filler like "definitely" or "for sure" or "you should check out".

ANSWERING RULES:
- If they ask for X number of things → give exactly X things, no more, no less.
- If they ask for recs → actually name them all in one flowing sentence, then add one line of context.
- If they're being funny → match the energy.
- If they're debating → take a side briefly.
- Keep total response under 60 words.
            `.trim();

            const userPrompt = `
--- CONTEXT ---
${contextPayload}

--- USER SAID ---
"${context.mentionText}"

Reply naturally. If they asked for a specific number of recommendations, give exactly that many, named inline in a sentence — not as a list. No markdown. No bullets. Under 60 words.
            `.trim();

            console.log(`[ReplyBotService] Requesting Groq response for thread: ${thread.title}`);

            const response = await axios.post(GROQ_API_URL, {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.85,
                max_tokens: 200
            }, {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            let aiText: string = response.data.choices[0].message.content?.trim() || "";

            // Strip any markdown that slipped through — bold, italic, headers, bullets
            aiText = aiText
                .replace(/\*\*(.*?)\*\*/g, '$1')   // bold
                .replace(/\*(.*?)\*/g, '$1')         // italic
                .replace(/^#{1,6}\s+/gm, '')         // headers
                .replace(/^[-*]\s+/gm, '')            // bullet points
                .replace(/^\d+\.\s+/gm, '')           // numbered lists
                .trim();

            return aiText || null;

        } catch (error: any) {
            console.error("[ReplyBotService] Groq API Error:", error.response?.data || error.message);
            return "Brain's buffering, try pinging me again in a sec.";
        }
    }

    static async postAIReply(context: BotContext, aiContent: string) {
        try {
            const botUser = await BotService.getBotUser();

            if (context.replyId) {
                // Replying to a reply (nested)
                const parentReply = await prisma.reply.findUnique({ where: { id: context.replyId } });
                if (!parentReply) return;

                const segment = Date.now().toString(36);
                const path = `${parentReply.path}.${segment}`;

                await prisma.reply.create({
                    data: {
                        content: aiContent,
                        commentId: context.commentId || parentReply.commentId,
                        parentId: context.replyId,
                        authorId: botUser.id,
                        username: "Convoxa AI",
                        path: path,
                        depth: parentReply.depth + 1
                    }
                });
            } else if (context.commentId) {
                // Replying to a top-level comment
                const segment = Date.now().toString(36);
                await prisma.reply.create({
                    data: {
                        content: aiContent,
                        commentId: context.commentId,
                        parentId: null,
                        authorId: botUser.id,
                        username: "Convoxa AI",
                        path: segment,
                        depth: 0
                    }
                });
            }
        } catch (error) {
            console.error("[ReplyBotService] Failed to post AI reply:", error);
        }
    }
}