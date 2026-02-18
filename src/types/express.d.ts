import type { JwtPayload } from "./modules/auth/auth.types.js";

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export { };
