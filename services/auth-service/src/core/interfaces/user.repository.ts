import { User } from "../entities/user.entity";

export interface IUserRepository {
  create(user: User): Promise<User>;
  findByEmail(email: string): Promise<Omit<User, "passwordHash"> | null>;
  findWithPasswordByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<Omit<User, "passwordHash"> | null>;
  findAll(limit: number, offset: number, role?: string): Promise<Omit<User, "passwordHash">[]>;
  countAll(role?: string): Promise<number>;
  updateActivity(userId: string, isActive: boolean): Promise<void>;
  updateActiveSession(userId: string, sessionId: string | null): Promise<void>;
  findActiveSession(userId: string): Promise<string | null>;
}
