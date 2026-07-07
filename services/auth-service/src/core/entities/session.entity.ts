export type SessionPlatform = "web" | "ios" | "android";

export type SessionRevokedReason =
  | "logout"
  | "logout_all"
  | "reuse_detected"
  | "new_login_single_device"
  | "expired_cleanup";

export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  platform?: SessionPlatform | null;
  browser?: string | null;
  os?: string | null;
  deviceName?: string | null;
  ipAddress?: string | null;
  refreshTokenHash: string;
  previousTokenHash?: string | null;
  lastActivity: Date;
  expiresAt: Date;
  revoked: boolean;
  revokedReason?: SessionRevokedReason | null;
  revokedAt?: Date | null;
  createdAt: Date;
}

export interface SessionSummary {
  id: string;
  deviceId: string;
  platform?: SessionPlatform | null;
  browser?: string | null;
  os?: string | null;
  deviceName?: string | null;
  ipAddress?: string | null;
  lastActivity: Date;
  createdAt: Date;
  isCurrent: boolean;
}
