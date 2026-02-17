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
  constructor(private userRepo: IUserRepository, private refreshTokenRepo: IRefreshTokenRepository) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    // Validate email
    if (!this.isValidEmail(dto.email)) {
      throw new ValidationError("Invalid email format");
    }

    // Check if user exists
    const existingUser = await this.userRepo.findByEmail(dto.email);
    if (existingUser) {
      throw new ValidationError("Email already registered");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user
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

    // Generate tokens
    return this.generateTokenPair(user);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    // Find user
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedError("Invalid credentials");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Account is inactive");
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Generate tokens
    return this.generateTokenPair(user);
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    // Verify refresh token
    const tokenRecord = await this.refreshTokenRepo.findByToken(refreshToken);
    if (!tokenRecord) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Get user
    const user = await this.userRepo.findById(tokenRecord.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("User not found or inactive");
    }

    // Delete old refresh token
    await this.refreshTokenRepo.deleteByUserId(user.id);

    // Generate new tokens
    return this.generateTokenPair(user);
  }

  async validateToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, config.jwtAccessSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      throw new UnauthorizedError("Invalid token");
    }
  }

  async logout(userId: string): Promise<void> {
    await this.refreshTokenRepo.deleteByUserId(userId);
  }

  async getUsers(): Promise<User[]> {
    return this.userRepo.findAll();
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  async updateUserStatus(id: string, status: string): Promise<void> {
    const isActive = status === "active";
    await this.userRepo.updateActivity(id, isActive);
  }

  // New method to issue service-to-service tokens
  async issueServiceToken(clientId: string, clientSecret: string): Promise<{ access_token: string, token_type: string, expires_in: number }> {
    const serviceClient = config.registeredServiceClients.find(
      client => client.clientId === clientId && client.clientSecret === clientSecret
    );

    if (!serviceClient) {
      throw new UnauthorizedError("Invalid client credentials");
    }

    const payload = {
      sub: serviceClient.clientId, // Subject is the client ID
      scope: serviceClient.scope,  // Scope of the service client
      iss: "auth-service",         // Issuer
    };

    const accessToken = jwt.sign(
      payload,
      config.jwtServiceAccessSecret as any, // Use service-specific secret
      {
        expiresIn: config.jwtServiceAccessExpiry,
        audience: "city-market-services", // Audience could be specific services or a general identifier
        jwtid: randomUUID(), // Unique JWT ID
      } as any
    );

    // Parse expiry string (e.g., "15m") to seconds
    let expiresInSeconds = 0;
    const expiryMatch = (config.jwtServiceAccessExpiry as string).match(/^(\d+)([smhd])$/);
    if (expiryMatch) {
        const value = parseInt(expiryMatch[1]);
        const unit = expiryMatch[2];
        switch (unit) {
            case 's': expiresInSeconds = value; break;
            case 'm': expiresInSeconds = value * 60; break;
            case 'h': expiresInSeconds = value * 3600; break;
            case 'd': expiresInSeconds = value * 86400; break;
        }
    } else {
        // Fallback or throw error if expiry format is unexpected
        expiresInSeconds = 15 * 60; // Default to 15 minutes if parsing fails
    }


    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresInSeconds, // Return expiry in seconds
    };
  }

  private async generateTokenPair(user: User): Promise<TokenPair> {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(
      payload,
      config.jwtAccessSecret as any,
      {
        expiresIn: config.jwtAccessExpiry,
      } as any
    );

    const refreshToken = jwt.sign(
      payload,
      config.jwtRefreshSecret as any,
      {
        expiresIn: config.jwtRefreshExpiry,
      } as any
    );

    // Store refresh token
    const tokenRecord: RefreshToken = {
      id: randomUUID(),
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
    };

    await this.refreshTokenRepo.create(tokenRecord);

    const { passwordHash, ...userProfile } = user;

    return { accessToken, refreshToken, user: userProfile };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
