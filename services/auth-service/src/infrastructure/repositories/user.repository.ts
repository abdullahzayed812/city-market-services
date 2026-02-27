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

  async findAll(limit: number, offset: number, role?: string): Promise<User[]> {
    let query = "SELECT * FROM users";
    const params: any[] = [];

    if (role) {
      query += " WHERE role = ?";
      params.push(role);
    }

    query += " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await this.pool.query<RowDataPacket[]>(query, params);
    return rows.map(this.mapToEntity);
  }

  async countAll(role?: string): Promise<number> {
    let query = "SELECT COUNT(*) as count FROM users";
    const params: any[] = [];

    if (role) {
      query += " WHERE role = ?";
      params.push(role);
    }

    const [rows] = await this.pool.query<RowDataPacket[]>(query, params);
    return rows[0].count;
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
