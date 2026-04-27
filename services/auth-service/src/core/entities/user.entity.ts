import { UserRole } from "@city-market/shared";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  activeSession?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
