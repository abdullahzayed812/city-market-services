import { Session, SessionRevokedReason, SessionSummary } from "../entities/session.entity";

export interface ISessionRepository {
  create(session: Session): Promise<Session>;
  findByCurrentHash(refreshTokenHash: string): Promise<Session | null>;
  findByPreviousHash(previousTokenHash: string): Promise<Session | null>;
  rotate(
    sessionId: string,
    updates: {
      previousTokenHash: string;
      refreshTokenHash: string;
      lastActivity: Date;
      ipAddress?: string | null;
    },
  ): Promise<void>;
  revokeOne(sessionId: string, reason: SessionRevokedReason): Promise<void>;
  revokeAllForUser(userId: string, reason: SessionRevokedReason): Promise<void>;
  listActiveForUser(userId: string): Promise<SessionSummary[]>;
  deleteExpired(): Promise<void>;
}
