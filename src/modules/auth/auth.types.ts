export type UserRole = "USER" | "MODERATOR" | "ADMIN";

export interface RegisterDTO {
    email: string;
    username: string;
    password: string;
    avatarConfig?: any;
}

export interface LoginDTO {
    email: string;
    password: string;
}

export interface CompleteProfileDTO {
    userId: string;
    username: string;
    avatarConfig: any;
}

export interface JwtPayload {
    userId: string;
    role: string;
    username: string;
}

export interface UserResponse {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    avatarConfig: any;
    isProfileComplete: boolean;
    createdAt: Date;
    updatedAt: Date;
}
