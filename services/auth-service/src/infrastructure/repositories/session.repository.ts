import { Pool, RowDataPacket } from "mysql2/promise";
import { Session, SessionRevokedReason, SessionSummary } from "../../core/entities/session.entity";
import { ISessionRepository } from "../../core/interfaces/session.repository";
import { Database } from "@city-market/shared/node";

export class SessionRepository implements ISessionRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(session: Session): Promise<Session> {
    const query = `
      INSERT INTO sessions (
        id, user_id, device_id, platform, browser, os, device_name,
        ip_address, refresh_token_hash, previous_token_hash,
        last_activity, expires_at, revoked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.pool.execute(query, [
      session.id,
      session.userId,
      session.deviceId,
      session.platform ?? null,
      session.browser ?? null,
      session.os ?? null,
      session.deviceName ?? null,
      session.ipAddress ?? null,
      session.refreshTokenHash,
      session.previousTokenHash ?? null,
      session.lastActivity,
      session.expiresAt,
      session.revoked,
    ]);
    return session;
  }

  async findByCurrentHash(refreshTokenHash: string): Promise<Session | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT * FROM sessions WHERE refresh_token_hash = ? LIMIT 1",
      [refreshTokenHash],
    );
    if (rows.length === 0) return null;
    return this.mapToEntity(rows[0]);
  }

  async findByPreviousHash(previousTokenHash: string): Promise<Session | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT * FROM sessions WHERE previous_token_hash = ? LIMIT 1",
      [previousTokenHash],
    );
    if (rows.length === 0) return null;
    return this.mapToEntity(rows[0]);
  }

  async rotate(
    sessionId: string,
    updates: {
      previousTokenHash: string;
      refreshTokenHash: string;
      lastActivity: Date;
      ipAddress?: string | null;
    },
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE sessions
       SET previous_token_hash = ?, refresh_token_hash = ?, last_activity = ?,
           ip_address = COALESCE(?, ip_address)
       WHERE id = ?`,
      [updates.previousTokenHash, updates.refreshTokenHash, updates.lastActivity, updates.ipAddress ?? null, sessionId],
    );
  }

  async revokeOne(sessionId: string, reason: SessionRevokedReason): Promise<void> {
    await this.pool.execute(
      "UPDATE sessions SET revoked = TRUE, revoked_reason = ?, revoked_at = NOW() WHERE id = ?",
      [reason, sessionId],
    );
  }

  async revokeAllForUser(userId: string, reason: SessionRevokedReason): Promise<void> {
    await this.pool.execute(
      "UPDATE sessions SET revoked = TRUE, revoked_reason = ?, revoked_at = NOW() WHERE user_id = ? AND revoked = FALSE",
      [reason, userId],
    );
  }

  async listActiveForUser(userId: string): Promise<SessionSummary[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM sessions WHERE user_id = ? AND revoked = FALSE AND expires_at > NOW()
       ORDER BY last_activity DESC`,
      [userId],
    );
    return rows.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      platform: row.platform,
      browser: row.browser,
      os: row.os,
      deviceName: row.device_name,
      ipAddress: row.ip_address,
      lastActivity: row.last_activity,
      createdAt: row.created_at,
      isCurrent: false,
    }));
  }

  async deleteExpired(): Promise<void> {
    await this.pool.execute("DELETE FROM sessions WHERE expires_at < NOW()");
  }

  private mapToEntity(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      deviceId: row.device_id,
      platform: row.platform,
      browser: row.browser,
      os: row.os,
      deviceName: row.device_name,
      ipAddress: row.ip_address,
      refreshTokenHash: row.refresh_token_hash,
      previousTokenHash: row.previous_token_hash,
      lastActivity: row.last_activity,
      expiresAt: row.expires_at,
      revoked: !!row.revoked,
      revokedReason: row.revoked_reason,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
    };
  }
}
