import { User } from "../entities/user.entity";

export interface IUserRepository {
  create(user: User): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findAll(limit: number, offset: number, role?: string): Promise<User[]>;
  countAll(role?: string): Promise<number>;
  updateActivity(userId: string, isActive: boolean): Promise<void>;
}
