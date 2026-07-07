import { UserRole } from "@city-market/shared";
import { User } from "../entities/user.entity";
import { SessionPlatform } from "../entities/session.entity";

export interface RegisterDto {
  email: string;
  password: string;
  role: UserRole;
  deviceId: string;
  platform?: SessionPlatform;
  deviceName?: string;
}

export interface LoginDto {
  email: string;
  password: string;
  deviceId: string;
  platform?: SessionPlatform;
  deviceName?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, "passwordHash">;
}

// sessionId refers to sessions.id, not a JWT-embedded refresh secret
export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId?: string;
}
