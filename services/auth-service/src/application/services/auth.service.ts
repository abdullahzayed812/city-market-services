import { randomUUID, randomBytes, createHash } from "crypto";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { IUserRepository } from "../../core/interfaces/user.repository";
import { ISessionRepository } from "../../core/interfaces/session.repository";
import { RegisterDto, LoginDto, TokenPair, TokenPayload } from "../../core/dto/auth.dto";
import { DeviceContext } from "../../core/dto/device-context.dto";
import { Session, SessionSummary } from "../../core/entities/session.entity";
import { User } from "../../core/entities/user.entity";
import { config } from "../../config/env";
import { parseDurationMs } from "../../utils/duration";
import { ValidationError, UnauthorizedError, UserRole } from "@city-market/shared";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// Tolerate near-simultaneous refresh calls that race the same pre-rotation token
// (e.g. React StrictMode double-invoking a mount effect, or two tabs refreshing at
// once) instead of treating the loser as a stolen/replayed token.
const REFRESH_REUSE_GRACE_MS = 10_000;

function stripPasswordHash(user: User): Omit<User, "passwordHash"> {
  const { passwordHash, ...rest } = user;
  return rest;
}

export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private sessionRepo: ISessionRepository,
  ) {}

  async register(dto: RegisterDto, deviceCtx: DeviceContext): Promise<TokenPair> {
    if (!this.isValidEmail(dto.email)) {
      throw new ValidationError("invalid_email_format");
    }

    if (!dto.role || !Object.values(UserRole).includes(dto.role)) {
      throw new ValidationError("invalid_or_missing_role");
    }

    const existingUser = await this.userRepo.findByEmail(dto.email);
    if (existingUser) {
      throw new ValidationError("email_already_registered");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user: User = {
      id: randomUUID(),
      email: dto.email,
      passwordHash,
      role: dto.role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.userRepo.create(user);

    const safeUser = stripPasswordHash(user);
    const { session, rawRefreshToken } = await this.createSession(safeUser, deviceCtx);
    const accessToken = this.issueAccessToken(safeUser, session.id);
    return { accessToken, refreshToken: rawRefreshToken, user: safeUser };
  }

  async login(dto: LoginDto, deviceCtx: DeviceContext): Promise<TokenPair> {
    const user = await this.userRepo.findWithPasswordByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedError("invalid_credentials");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("account_inactive");
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError("invalid_credentials");
    }

    // Single active device: revoke every other session before creating the new one
    await this.sessionRepo.revokeAllForUser(user.id, "new_login_single_device");

    const safeUser = stripPasswordHash(user);
    const { session, rawRefreshToken } = await this.createSession(safeUser, deviceCtx);
    const accessToken = this.issueAccessToken(safeUser, session.id);
    return { accessToken, refreshToken: rawRefreshToken, user: safeUser };
  }

  async refreshToken(rawToken: string, deviceCtx: DeviceContext): Promise<TokenPair> {
    const hash = sha256Hex(rawToken);
    let session = await this.sessionRepo.findByCurrentHash(hash);

    if (!session) {
      // Not the current token — check whether it's the token we just rotated away from.
      const stale = await this.sessionRepo.findByPreviousHash(hash);
      const withinGraceWindow = !!stale && Date.now() - stale.lastActivity.getTime() < REFRESH_REUSE_GRACE_MS;

      if (!stale || stale.revoked || !withinGraceWindow) {
        // Unknown token, or a stale token reused well after rotation — treat as a replay/theft.
        if (stale && !stale.revoked) {
          await this.sessionRepo.revokeAllForUser(stale.userId, "reuse_detected");
        }
        throw new UnauthorizedError("invalid_refresh_token");
      }

      // Benign race: another concurrent request already rotated this token moments ago
      // (duplicate mount effect, second tab, etc). Resync onto that session instead of
      // punishing this caller as a replay — the rest of the flow rotates it again below.
      session = stale;
    }

    if (session.revoked || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("session_expired_or_revoked");
    }

    const user = await this.userRepo.findById(session.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("user_not_found_or_inactive");
    }

    const rawRefreshToken = randomBytes(32).toString("base64url");
    const newHash = sha256Hex(rawRefreshToken);

    await this.sessionRepo.rotate(session.id, {
      previousTokenHash: session.refreshTokenHash,
      refreshTokenHash: newHash,
      lastActivity: new Date(),
      ipAddress: deviceCtx.ipAddress ?? session.ipAddress ?? null,
    });

    const accessToken = this.issueAccessToken(user, session.id);
    return { accessToken, refreshToken: rawRefreshToken, user };
  }

  async validateToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, config.jwtAccessSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      throw new UnauthorizedError("invalid_token");
    }
  }

  /** Revoke only the caller's current session. */
  async logout(sessionId: string): Promise<void> {
    await this.sessionRepo.revokeOne(sessionId, "logout");
  }

  /** Revoke every session belonging to the user (logout on all devices). */
  async logoutAll(userId: string): Promise<void> {
    await this.sessionRepo.revokeAllForUser(userId, "logout_all");
  }

  async listSessions(userId: string, currentSessionId?: string): Promise<SessionSummary[]> {
    const sessions = await this.sessionRepo.listActiveForUser(userId);
    return sessions.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
  }

  async getUsers(
    page: number = 1,
    limit: number = 50,
    role?: string,
  ): Promise<{ data: Omit<User, "passwordHash">[]; total: number }> {
    const offset = (page - 1) * limit;
    const users = await this.userRepo.findAll(limit, offset, role);
    const total = await this.userRepo.countAll(role);
    return { data: users, total };
  }

  async countUsers(role?: string): Promise<number> {
    return this.userRepo.countAll(role);
  }

  async getUserById(id: string): Promise<Omit<User, "passwordHash"> | null> {
    return this.userRepo.findById(id);
  }

  async updateUserStatus(id: string, status: string): Promise<void> {
    const isActive = status === "active";
    await this.userRepo.updateActivity(id, isActive);
  }

  async issueServiceToken(
    clientId: string,
    clientSecret: string,
  ): Promise<{ access_token: string; token_type: string; expires_in: number }> {
    const serviceClient = config.registeredServiceClients.find(
      (client) => client.clientId === clientId && client.clientSecret === clientSecret,
    );

    if (!serviceClient) {
      throw new UnauthorizedError("invalid_client_credentials");
    }

    const payload = {
      sub: serviceClient.clientId,
      scope: serviceClient.scope,
      iss: "auth-service",
    };

    const accessToken = jwt.sign(
      payload,
      config.jwtServiceAccessSecret as any,
      {
        expiresIn: config.jwtServiceAccessExpiry,
        audience: "city-market-services",
        jwtid: randomUUID(),
      } as any,
    );

    let expiresInSeconds = 0;
    const expiryMatch = (config.jwtServiceAccessExpiry as string).match(/^(\d+)([smhd])$/);
    if (expiryMatch) {
      const value = parseInt(expiryMatch[1]);
      const unit = expiryMatch[2];
      switch (unit) {
        case "s": expiresInSeconds = value; break;
        case "m": expiresInSeconds = value * 60; break;
        case "h": expiresInSeconds = value * 3600; break;
        case "d": expiresInSeconds = value * 86400; break;
      }
    } else {
      expiresInSeconds = 15 * 60;
    }

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresInSeconds,
    };
  }

  private async createSession(
    user: Omit<User, "passwordHash">,
    deviceCtx: DeviceContext,
  ): Promise<{ session: Session; rawRefreshToken: string }> {
    const rawRefreshToken = randomBytes(32).toString("base64url");
    const refreshTokenHash = sha256Hex(rawRefreshToken);
    const now = new Date();

    const session: Session = {
      id: randomUUID(),
      userId: user.id,
      deviceId: deviceCtx.deviceId,
      platform: deviceCtx.platform ?? null,
      browser: deviceCtx.browser ?? null,
      os: deviceCtx.os ?? null,
      deviceName: deviceCtx.deviceName ?? null,
      ipAddress: deviceCtx.ipAddress ?? null,
      refreshTokenHash,
      previousTokenHash: null,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + parseDurationMs(config.refreshExpiry)),
      revoked: false,
      createdAt: now,
    };

    await this.sessionRepo.create(session);
    return { session, rawRefreshToken };
  }

  private issueAccessToken(user: Omit<User, "passwordHash">, sessionId: string): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };
    return jwt.sign(payload, config.jwtAccessSecret as any, {
      expiresIn: config.jwtAccessExpiry,
    } as any);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
