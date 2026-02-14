import { Pool, RowDataPacket } from "mysql2/promise";
import { RefreshToken } from "../../core/entities/refresh-token.entity";
import { IRefreshTokenRepository } from "../../core/interfaces/refresh-token.repository";
import { Database } from "@city-market/shared/node";

export class RefreshTokenRepository implements IRefreshTokenRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(token: RefreshToken): Promise<RefreshToken> {
    const query = `
      INSERT INTO refresh_tokens (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `;
    await this.pool.execute(query, [token.id, token.userId, token.token, token.expiresAt]);
    return token;
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    const query = "SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [token]);

    if (rows.length === 0) return null;

    return this.mapToEntity(rows[0]);
  }

  async deleteByUserId(userId: string): Promise<void> {
    const query = "DELETE FROM refresh_tokens WHERE user_id = ?";
    await this.pool.query(query, [userId]);
  }

  async deleteExpired(): Promise<void> {
    const query = "DELETE FROM refresh_tokens WHERE expires_at < NOW()";
    await this.pool.execute(query);
  }

  private mapToEntity(row: any): RefreshToken {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}
