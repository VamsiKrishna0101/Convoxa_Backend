import 'dotenv/config';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma.js";
import { redis as redisClient } from "../../config/redis.js";
import { EmailService } from "../../services/email.service.js";
import type { RegisterDTO, LoginDTO, JwtPayload } from './auth.types.js'
const SALT_ROUNDS = 10;

export class AuthService {
    // ---------------- REGISTER ----------------
    static async register(input: RegisterDTO) {
        const { email, username, password } = input;

        if (!email || !username || !password) {
            throw new Error("INVALID_INPUT");
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }],
            },
        });

        if (existingUser) {
            throw new Error("USER_EXISTS");
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await prisma.user.create({
            data: {
                email,
                username,
                passwordHash,
                avatarConfig: input.avatarConfig || null,
                isProfileComplete: true, // Manually registered users have complete profiles
            } as any,
        });

        const tokens = this.issueTokens({
            userId: user.id,
            role: user.role,
            username: user.username,  // ← ADD THIS
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

    // ---------------- LOGIN ----------------
    static async login(input: LoginDTO) {
        const { email, password } = input;

        if (!email || !password) {
            throw new Error("INVALID_CREDENTIALS");
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw new Error("INVALID_CREDENTIALS");
        }

        if (!user.passwordHash) {
            throw new Error("INVALID_CREDENTIALS");
        }

        const isValid = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!isValid) {
            throw new Error("INVALID_CREDENTIALS");
        }

        const tokens = this.issueTokens({
            userId: user.id,
            role: user.role,
            username: user.username,  // ← ADD THIS
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

    // ---------------- REFRESH ----------------
    static refresh(refreshToken: string) {
        if (!refreshToken) {
            throw new Error("UNAUTHORIZED");
        }

        const payload = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET!
        ) as JwtPayload;

        return {
            accessToken: this.signAccessToken({
                userId: payload.userId,
                role: payload.role,
                username: payload.username,  // ← ADD THIS
            }),
        };
    }

    // ---------------- GET USER DETAILS ----------------
    static async getUserDetails(userId: string) {
        if (!userId) {
            throw new Error("UNAUTHORIZED");
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                avatarConfig: true,
                isProfileComplete: true,
                _count: {
                    select: {
                        followers: true,
                        following: true
                    }
                }
            },
        });

        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }

        return user;
    }

    // ---------------- COMPLETE PROFILE ----------------
    static async completeProfile(input: { userId: string, username: string, avatarConfig: any }) {
        const { userId, username, avatarConfig } = input;

        // Check if username is already taken by someone else
        const existingUser = await prisma.user.findFirst({
            where: {
                username,
                NOT: { id: userId }
            }
        });

        if (existingUser) {
            throw new Error("USERNAME_TAKEN");
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                username,
                avatarConfig,
                isProfileComplete: true
            } as any
        });

        return user as any;
    }


    // ---------------- FORGOT PASSWORD ----------------
    static async forgotPassword(email: string) {
        if (!email) throw new Error("INVALID_INPUT");

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Security: Don't reveal if user exists. Just return true.
            return true;
        }

        // Rate Limit Check
        const RATE_LIMIT_KEY = `rate_limit:forgot_pass:${email}`;
        const currentCount = await redisClient.get(RATE_LIMIT_KEY);

        if (currentCount && parseInt(currentCount) >= 2) {
            // Security: To prevent timing attacks or user enumeration, we might want to delay or return true
            // But for a rate limit, it's better to tell the user to try again later.
            throw new Error("TOO_MANY_REQUESTS");
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to Redis (Expire in 10 mins = 600s)
        await redisClient.set(`otp:${email}`, otp, 'EX', 600);

        // Increment Rate Limit
        await redisClient.incr(RATE_LIMIT_KEY);
        if (!currentCount) {
            // First attempt, set expiry to 24 hours (86400 seconds)
            await redisClient.expire(RATE_LIMIT_KEY, 86400);
        }

        // Send Email
        await EmailService.sendOtp({ to: email, otp, name: user.username });

        return true;
    }

    // ---------------- VERIFY OTP ----------------
    static async verifyOtp(email: string, otp: string) {
        if (!email || !otp) throw new Error("INVALID_INPUT");

        const storedOtp = await redisClient.get(`otp:${email}`);

        if (!storedOtp || storedOtp !== otp) {
            throw new Error("INVALID_OTP");
        }

        // OTP Valid! Delete it to prevent reuse
        await redisClient.del(`otp:${email}`);

        // Clear rate limit on successful verification (optional, but nice for UX)
        // await redisClient.del(`rate_limit:forgot_pass:${email}`);

        // Generate a temporary Reset Token (short lived, e.g. 15 mins)
        const resetToken = jwt.sign(
            { email, type: 'RESET_PASSWORD' },
            process.env.JWT_SECRET!,
            { expiresIn: '15m' }
        );

        return { resetToken };
    }

    // ---------------- RESET PASSWORD ----------------
    static async resetPassword(resetToken: string, newPassword: string) {
        if (!resetToken || !newPassword) throw new Error("INVALID_INPUT");

        try {
            const payload = jwt.verify(resetToken, process.env.JWT_SECRET!) as any;
            if (payload.type !== 'RESET_PASSWORD') throw new Error("INVALID_TOKEN");

            const email = payload.email;

            const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

            await prisma.user.update({
                where: { email },
                data: { passwordHash }
            });

            // Optional: Invalidate all existing sessions (if we tracked them)

            return true;
        } catch (e) {
            throw new Error("INVALID_OR_EXPIRED_TOKEN");
        }
    }

    // ---------------- TOKEN HELPERS ----------------
    public static issueTokens(payload: JwtPayload) {
        return {
            accessToken: this.signAccessToken(payload),
            refreshToken: this.signRefreshToken(payload),
        };
    }

    private static signAccessToken(payload: JwtPayload) {
        return jwt.sign(payload, process.env.JWT_SECRET!, {
            expiresIn: "30d",
        });
    }

    private static signRefreshToken(payload: JwtPayload) {
        return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
            expiresIn: "180d",
        });
    }

    // ---------------- CHECK USERNAME ----------------
    static async checkUsernameAvailability(username: string) {
        if (!username || username.length < 3) return { available: false, suggestions: [] };

        const existingUser = await prisma.user.findFirst({
            where: { username: { equals: username, mode: 'insensitive' } } // Case insensitive check
        });

        if (!existingUser) {
            return { available: true, suggestions: [] };
        }

        // Username is taken. Generate suggestions.
        const suggestions: string[] = [];
        let attempts = 0;

        while (suggestions.length < 3 && attempts < 10) {
            const randomSuffix = Math.floor(100 + Math.random() * 900); // 3 digit number
            const suggestion = `${username}${randomSuffix}`;

            // Check if suggestion exists
            const taken = await prisma.user.findFirst({
                where: { username: { equals: suggestion, mode: 'insensitive' } }
            });

            if (!taken && !suggestions.includes(suggestion)) {
                suggestions.push(suggestion);
            }
            attempts++;
        }

        return { available: false, suggestions };
    }
}
