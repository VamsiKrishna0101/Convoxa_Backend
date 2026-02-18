import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../modules/auth/auth.types.js";

export const requireAuth = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.sendStatus(401);
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.sendStatus(401);
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error("JWT_SECRET is not configured");
    }

    try {
        const decoded = jwt.verify(token, jwtSecret) as unknown;

        // Runtime type guard - now includes username
        if (
            typeof decoded !== "object" ||
            decoded === null ||
            !("userId" in decoded) ||
            !("role" in decoded) ||
            !("username" in decoded)  // ← Added username check
        ) {
            return res.sendStatus(401);
        }

        req.user = decoded as JwtPayload;
        next();
    } catch {
        return res.sendStatus(401);
    }
};