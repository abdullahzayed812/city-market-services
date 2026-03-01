import { Pool, RowDataPacket } from "mysql2/promise";
import { INotificationRepository } from "../../core/interfaces/notification.repository";
import { Notification, NotificationPreference, DeviceToken } from "../../core/entities/notification.entity";
import { Database } from "@city-market/shared/node";

export class NotificationRepository implements INotificationRepository {
  private pool: Pool;

  constructor(db: Database) {
    this.pool = db.getPool();
  }

  async create(notification: Notification): Promise<Notification> {
    const query = `
      INSERT INTO notifications (id, user_id, type, title, message, is_read, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.pool.execute(query, [
      notification.id,
      notification.userId,
      notification.type,
      notification.title,
      notification.message,
      notification.isRead,
      JSON.stringify(notification.metadata || {}),
      notification.createdAt,
    ]);
    return notification;
  }

  async findByUserId(userId: string, limit: number, offset: number): Promise<Notification[]> {
    const query = `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [userId, limit, offset]);
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      isRead: Boolean(row.is_read),
      metadata: row.metadata,
      createdAt: row.created_at,
    }));
  }

  async markAsRead(id: string): Promise<void> {
    await this.pool.execute("UPDATE notifications SET is_read = TRUE WHERE id = ?", [id]);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.pool.execute("UPDATE notifications SET is_read = TRUE WHERE user_id = ?", [userId]);
  }

  async countUnread(userId: string): Promise<number> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE",
      [userId],
    );
    return rows[0].count;
  }

  async getPreferences(userId: string): Promise<NotificationPreference | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT * FROM notification_preferences WHERE user_id = ?", [
      userId,
    ]);
    if (rows.length === 0) return null;
    return {
      userId: rows[0].user_id,
      emailEnabled: Boolean(rows[0].email_enabled),
      pushEnabled: Boolean(rows[0].push_enabled),
      smsEnabled: Boolean(rows[0].sms_enabled),
      updatedAt: rows[0].updated_at,
    };
  }

  async upsertPreferences(pref: NotificationPreference): Promise<void> {
    const query = `
      INSERT INTO notification_preferences (user_id, email_enabled, push_enabled, sms_enabled)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE email_enabled = VALUES(email_enabled), push_enabled = VALUES(push_enabled), sms_enabled = VALUES(sms_enabled)
    `;
    await this.pool.execute(query, [pref.userId, pref.emailEnabled, pref.pushEnabled, pref.smsEnabled]);
  }

  async addDeviceToken(token: DeviceToken): Promise<void> {
    const query = `
      INSERT INTO device_tokens (user_id, token, platform, app_type, last_active)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE last_active = NOW()
    `;
    await this.pool.execute(query, [token.userId, token.token, token.platform, token.appType, new Date()]);
  }

  async removeDeviceToken(token: string): Promise<void> {
    await this.pool.execute("DELETE FROM device_tokens WHERE token = ?", [token]);
  }

  async getDeviceTokens(userId: string): Promise<DeviceToken[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT * FROM device_tokens WHERE user_id = ?", [userId]);
    return rows.map((row) => ({
      userId: row.user_id,
      token: row.token,
      platform: row.platform,
      appType: row.app_type,
      lastActive: row.last_active,
    }));
  }
}
