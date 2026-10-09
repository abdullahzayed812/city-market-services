import { Pool, RowDataPacket } from "mysql2/promise";
import { User } from "../../core/entities/user.entity";
import { IUserRepository, UserListFilter } from "../../core/interfaces/user.repository";
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

  async findByEmail(email: string): Promise<Omit<User, "passwordHash"> | null> {
    const query = "SELECT * FROM users WHERE email = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [email]);

    if (rows.length === 0) return null;

    return this.mapToEntity(rows[0]);
  }

  async findWithPasswordByEmail(email: string): Promise<User | null> {
    const query = "SELECT * FROM users WHERE email = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [email]);

    if (rows.length === 0) return null;

    const row = rows[0];
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

  async findById(id: string): Promise<Omit<User, "passwordHash"> | null> {
    const query = "SELECT * FROM users WHERE id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);

    if (rows.length === 0) return null;

    return this.mapToEntity(rows[0]);
  }

  private buildWhere(role?: string, filter: UserListFilter = {}): { where: string; params: any[] } {
    const clauses: string[] = [];
    const params: any[] = [];
    if (role) {
      clauses.push("role = ?");
      params.push(role);
    }
    if (filter.search) {
      clauses.push("email LIKE ?");
      params.push(`%${filter.search.replace(/[%_\\]/g, "\\$&")}%`);
    }
    if (filter.isActive !== undefined) {
      clauses.push("is_active = ?");
      params.push(filter.isActive);
    }
    return { where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", params };
  }

  async findAll(limit: number, offset: number, role?: string, filter: UserListFilter = {}): Promise<Omit<User, "passwordHash">[]> {
    const { where, params } = this.buildWhere(role, filter);
    const query = `SELECT * FROM users${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [...params, limit, offset]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async countAll(role?: string, filter: UserListFilter = {}): Promise<number> {
    const { where, params } = this.buildWhere(role, filter);
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT COUNT(*) as count FROM users${where}`, params);
    return rows[0].count;
  }

  async updateActivity(userId: string, isActive: boolean): Promise<void> {
    const query = "UPDATE users SET is_active = ? WHERE id = ?";
    await this.pool.execute(query, [isActive, userId]);
  }

  private mapToEntity(row: any): Omit<User, "passwordHash"> {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
