import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../../config/prisma.js";
import { botQueue } from "../../config/queue.js";
import { BotJobType, CommentOnThreadPayload } from "./bot.types.js";

// Direct environment access for Cloud Run reliability

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

export class BotService {
    private static BOT_EMAIL = "bot@convoxa.com";
    private static BOT_USERNAME = "Convoxa AI";

    static async getBotUser() {
        const botTemplate = {
            email: this.BOT_EMAIL,
            username: this.BOT_USERNAME,
            passwordHash: "bot_secure_hash_v1",
            isProfileComplete: true,
            avatarConfig: {
                style: "bottts",
                options: {
                    seed: "ConvoxaBot",
                    mouthProbability: 100,
                    topProbability: 100,
                    sidesProbability: 100,
                    backgroundColor: ["#2d3436"]
                }
            }
        };

        let bot = await prisma.user.findUnique({
            where: { email: this.BOT_EMAIL }
        });

        if (!bot) {
            console.log("Creating Bot User (Convoxa AI)...");
            bot = await prisma.user.create({
                data: botTemplate
            });
        } else {
            // Update bot avatar if it changed or needs refresh
            bot = await prisma.user.update({
                where: { email: this.BOT_EMAIL },
                data: {
                    avatarConfig: botTemplate.avatarConfig
                }
            });
        }
        return bot;
    }

    static async generateContent(prompt: string): Promise<string | null> {
        try {
            if (!GEMINI_API_KEY) {
                console.error("[BotService] GEMINI_API_KEY is missing!");
                return null;
            }

            // Debug: Log key length and first/last chars
            const maskedKey = `${GEMINI_API_KEY.substring(0, 4)}...${GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 4)}`;
            console.log(`[BotService] Using Gemini API Key: ${maskedKey} (Length: ${GEMINI_API_KEY.length})`);

            try {
                console.log("[BotService] Trying primary model: gemini-2.0-flash");
                const result = await model.generateContent(prompt);
                const response = result.response;
                let text = response.text();
                text = text.replace(/^["']|["']$/g, '').trim();
                return text;
            } catch (primaryError: any) {
                console.warn("[BotService] Primary model failed, trying fallback: gemini-2.0-flash-lite. Error:", primaryError.message);
                try {
                    const result = await fallbackModel.generateContent(prompt);
                    const response = result.response;
                    let text = response.text();
                    text = text.replace(/^["']|["']$/g, '').trim();
                    return text;
                } catch (fallbackError: any) {
                    console.error("[BotService] Both models failed.", fallbackError.message);
                    throw fallbackError;
                }
            }
        } catch (error: any) {
            console.error("Gemini API Error details:", error?.response?.data || error.message);

            if (error.status === 403) {
                console.error("[BotService] 403 Forbidden: This usually means the API key is not being transmitted or is unregistered.");
            }

            return null; // Don't post anything on failure
        }
    }

    static async scheduleThreadComment(threadId: string) {
        console.log(`[BotService] Scheduling comment for thread ${threadId}`);
        await botQueue.add('COMMENT_ON_THREAD', {
            type: 'COMMENT_ON_THREAD',
            threadId
        }, {
            delay: 30 * 60 * 1000 // 30 minutes
        });
    }
}
