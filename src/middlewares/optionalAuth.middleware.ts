import 'dotenv/config';
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../modules/auth/auth.types.js";

export const optionalAuth = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return next();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        // We still proceed, but log error internally if needed
        return next();
    }

    try {
        const decoded = jwt.verify(token, jwtSecret) as unknown;

        // Runtime type guard
        if (
            typeof decoded === "object" &&
            decoded !== null &&
            "userId" in decoded &&
            "role" in decoded &&
            "username" in decoded
        ) {
            req.user = decoded as JwtPayload;
        }
        next();
    } catch {
        // If token is invalid, we just treat them as guest
        next();
    }
};
