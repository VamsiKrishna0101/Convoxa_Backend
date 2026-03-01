import 'dotenv/config';
import type { Request, Response } from "express";
import { AuthService } from './auth.services.js'
import { GoogleAuthService } from './googleAuth.service.js';
export const register = async (req: Request, res: Response) => {
    try {
        const { accessToken, refreshToken, user } =
            await AuthService.register(req.body);

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/auth/refresh",
        });

        res.status(201).json({ accessToken, user });
    } catch (err: any) {
        console.log(err)
        if (err.message === "USER_EXISTS") {
            return res.status(409).json({ message: "User already exists" });
        }
        res.status(400).json({ message: "Registration failed" });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { accessToken, refreshToken, user } =
            await AuthService.login(req.body);

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/auth/refresh",
        });

        res.json({ accessToken, user });
    } catch {
        res.status(401).json({ message: "Invalid credentials" });
    }
};

export const googleLogin = async (req: Request, res: Response) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ message: "Google ID token required" });
        }

        const { accessToken, refreshToken, user } = await GoogleAuthService.googleLogin(idToken);

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/auth/refresh",
        });

        res.json({ accessToken, user });
    } catch (err: any) {
        console.error("Google login error:", err);
        res.status(401).json({ message: err.message || "Google authentication failed" });
    }
};

export const refresh = async (req: Request, res: Response) => {
    try {
        const { accessToken } = AuthService.refresh(
            req.cookies?.refreshToken
        );
        res.json({ accessToken });
    } catch {
        res.sendStatus(401);
    }
};

export const logout = async (_req: Request, res: Response) => {
    res.clearCookie("refreshToken", { path: "/auth/refresh" });
    res.sendStatus(204);
};

export const getUserDetails = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const user = await AuthService.getUserDetails(userId);

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (err: any) {
        if (err.message === "USER_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        res.status(500).json({
            success: false,
            message: "Failed to fetch user details"
        });
    }
};

export const completeProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { username, avatarConfig } = req.body;
        if (!username) {
            return res.status(400).json({ message: "Username required" });
        }

        const user = await AuthService.completeProfile({
            userId,
            username,
            avatarConfig
        });

        // Issue new tokens since profile status has changed
        const tokens = (AuthService as any).issueTokens({
            userId: user.id,
            role: user.role,
            username: user.username,
        });

        // Issue new tokens since profile status has changed
        const { accessToken, refreshToken, user: updatedUser } = (AuthService as any).issueTokens({
            userId: user.id,
            role: user.role,
            username: user.username,
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/auth/refresh",
        });

        res.json({
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                avatarConfig: user.avatarConfig,
                isProfileComplete: user.isProfileComplete
            }
        });
    } catch (err: any) {
        if (err.message === "USERNAME_TAKEN") {
            return res.status(409).json({ message: "Username already taken" });
        }
        res.status(500).json({ message: "Failed to complete profile" });
    }
}


export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        await AuthService.forgotPassword(email);
        // Always return success to prevent email enumeration
        res.json({ message: "If account exists, OTP sent" });
    } catch (err) {
        res.status(500).json({ message: "Failed to process request" });
    }
};

export const verifyOtp = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        const result = await AuthService.verifyOtp(email, otp);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ message: err.message || "Invalid OTP" });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { resetToken, newPassword } = req.body;
        await AuthService.resetPassword(resetToken, newPassword);
        res.json({ message: "Password reset successful" });
    } catch (err: any) {
        res.status(400).json({ message: err.message || "Failed to reset password" });
    }
};

export const checkUsername = async (req: Request, res: Response) => {
    try {
        const { username } = req.body;
        const result = await AuthService.checkUsernameAvailability(username);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ message: "Failed to check username" });
    }
};

