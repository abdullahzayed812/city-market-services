import { Pool, RowDataPacket } from "mysql2/promise";
import { User } from "../../core/entities/user.entity";
import { IUserRepository } from "../../core/interfaces/user.repository";
import { Database } from "@city-market/shared/node";

export class UserRepository implements IUserRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(user: User): Promise<User> {
    const query = `
      INSERT INTO users (id, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?)
    `;
    await this.pool.execute(query, [user.id, user.email, user.passwordHash, user.role, user.isActive]);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = "SELECT * FROM users WHERE email = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [email]);

    if (rows.length === 0) return null;

    return this.mapToEntity(rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const query = "SELECT * FROM users WHERE id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);

    if (rows.length === 0) return null;

    return this.mapToEntity(rows[0]);
  }

  async findAll(): Promise<User[]> {
    const query = "SELECT * FROM users";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query);
    return rows.map(this.mapToEntity);
  }

  async updateActivity(userId: string, isActive: boolean): Promise<void> {
    const query = "UPDATE users SET is_active = ? WHERE id = ?";
    await this.pool.execute(query, [isActive, userId]);
  }

  private mapToEntity(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
