import { OAuth2Client } from 'google-auth-library';
import prisma from "../../config/prisma.js";
import { AuthService } from "./auth.services.js";

const client = new OAuth2Client();

export class GoogleAuthService {
    static async verifyGoogleToken(idToken: string) {
        try {
            const ticket = await client.verifyIdToken({
                idToken,
                audience: [
                    '75341912220-7d1jttbj825tha2dhe5b2jc6u42vpoda.apps.googleusercontent.com', // Web
                    '75341912220-qrkd2vti2l2e0r2ioiejcnah9v8fqgrf.apps.googleusercontent.com'  // Android
                ],
            });
            const payload = ticket.getPayload();
            if (!payload) {
                throw new Error("INVALID_GOOGLE_TOKEN");
            }
            return payload;
        } catch (error) {
            console.error("Google Token Verification Error:", error);
            throw new Error("GOOGLE_AUTH_FAILED");
        }
    }

    static async googleLogin(idToken: string) {
        const payload = await this.verifyGoogleToken(idToken);
        const { email, sub: googleId, name, picture } = payload;

        if (!email) {
            throw new Error("EMAIL_MISSING_FROM_GOOGLE");
        }

        // Try to find user by googleId or email
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { googleId },
                    { email }
                ]
            }
        });

        if (user) {
            // If user exists by email but doesn't have googleId, link them
            if (!user.googleId) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { googleId }
                });
            }
        } else {
            // New user - generate a temporary unique username
            const baseUsername = name?.replace(/\s+/g, '').toLowerCase() || email.split('@')[0];
            let username = baseUsername;
            let counter = 1;

            // Ensure username uniqueness
            while (await prisma.user.findUnique({ where: { username } })) {
                username = `${baseUsername}${counter}`;
                counter++;
            }

            user = await prisma.user.create({
                data: {
                    email,
                    googleId,
                    username,
                    isProfileComplete: false,
                    // Note: passwordHash remains null for Google users
                }
            });
        }

        // Issue tokens using existing AuthService logic
        // We might need to make issueTokens public or replicate it
        const tokens = (AuthService as any).issueTokens({
            userId: user.id,
            role: user.role,
            username: user.username,
        });

        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                avatarConfig: user.avatarConfig,
                isProfileComplete: user.isProfileComplete,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        };
    }
}
