import { randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { IUserRepository } from "../../core/interfaces/user.repository";
import { IRefreshTokenRepository } from "../../core/interfaces/refresh-token.repository";
import { RegisterDto, LoginDto, TokenPair, TokenPayload } from "../../core/dto/auth.dto";
import { User } from "../../core/entities/user.entity";
import { RefreshToken } from "../../core/entities/refresh-token.entity";
import { config } from "../../config/env";
import { ValidationError, UnauthorizedError } from "@city-market/shared";

export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private refreshTokenRepo: IRefreshTokenRepository,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    if (!this.isValidEmail(dto.email)) {
      throw new ValidationError("invalid_email_format");
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

    return this.generateTokenPair(user);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
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

    // Invalidate any existing session and refresh tokens for this user
    await this.refreshTokenRepo.deleteByUserId(user.id);

    return this.generateTokenPair(user);
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const tokenRecord = await this.refreshTokenRepo.findByToken(refreshToken);
    if (!tokenRecord) {
      throw new UnauthorizedError("invalid_refresh_token");
    }

    const user = await this.userRepo.findById(tokenRecord.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("user_not_found_or_inactive");
    }

    // Verify that the session in this refresh token is still the active session
    let tokenSessionId: string | undefined;
    try {
      const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret as any) as TokenPayload;
      tokenSessionId = decoded.sessionId;
    } catch {
      await this.refreshTokenRepo.deleteByUserId(user.id);
      throw new UnauthorizedError("invalid_refresh_token");
    }

    const activeSession = await this.userRepo.findActiveSession(user.id);
    if (!tokenSessionId || tokenSessionId !== activeSession) {
      // Another device has logged in — this session is no longer valid
      await this.refreshTokenRepo.deleteByUserId(user.id);
      throw new UnauthorizedError("session_invalidated");
    }

    await this.refreshTokenRepo.deleteByUserId(user.id);

    return this.generateTokenPair(user);
  }

  async validateToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, config.jwtAccessSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      throw new UnauthorizedError("invalid_token");
    }
  }

  async logout(userId: string): Promise<void> {
    await this.refreshTokenRepo.deleteByUserId(userId);
    await this.userRepo.updateActiveSession(userId, null);
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

  private async generateTokenPair(user: Omit<User, "passwordHash">): Promise<TokenPair> {
    const sessionId = randomUUID();

    // Persist the new active session, invalidating any previous one
    await this.userRepo.updateActiveSession(user.id, sessionId);

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };

    const accessToken = jwt.sign(
      payload,
      config.jwtAccessSecret as any,
      { expiresIn: config.jwtAccessExpiry } as any,
    );

    const refreshToken = jwt.sign(
      payload,
      config.jwtRefreshSecret as any,
      { expiresIn: config.jwtRefreshExpiry } as any,
    );

    const tokenRecord: RefreshToken = {
      id: randomUUID(),
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    await this.refreshTokenRepo.create(tokenRecord);

    return { accessToken, refreshToken, user };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
