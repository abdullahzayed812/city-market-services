import { UserRole } from "@city-market/shared";
import { User } from "../entities/user.entity";

export interface RegisterDto {
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, "passwordHash">;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId?: string;
}
