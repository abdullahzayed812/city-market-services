import { User } from "../entities/user.entity";

export interface IUserRepository {
  create(user: User): Promise<User>;
  findByEmail(email: string): Promise<Omit<User, "passwordHash"> | null>;
  findWithPasswordByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<Omit<User, "passwordHash"> | null>;
  findAll(limit: number, offset: number, role?: string, filter?: UserListFilter): Promise<Omit<User, "passwordHash">[]>;
  countAll(role?: string, filter?: UserListFilter): Promise<number>;
  updateActivity(userId: string, isActive: boolean): Promise<void>;
}

// Admin list filters (role is passed separately for backward compatibility)
export interface UserListFilter {
  // Case-insensitive substring of the email
  search?: string;
  isActive?: boolean;
}
