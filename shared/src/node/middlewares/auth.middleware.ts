import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../../utils/errors.js";
import { UserRole } from "../../enums/roles.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: UserRole;
    email?: string;
  };
  service?: {
    clientId: string;
    scope: string;
  };
  authType?: "user" | "service";
}

export interface UserTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface ServiceTokenPayload {
  sub: string; // clientId
  scope: string;
  iss: string;
  aud?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      throw new UnauthorizedError("No token provided");
    }

    // First, try to decode without verification to check the token structure
    const decoded = jwt.decode(token) as any;

    if (!decoded) {
      throw new UnauthorizedError("Invalid token format");
    }

    // Determine token type based on payload structure
    const isServiceToken = decoded.sub && decoded.scope && decoded.iss === "auth-service";
    const isUserToken = decoded.userId && decoded.role;

    if (isServiceToken) {
      // Verify service token
      const serviceSecret = process.env.JWT_SERVICE_ACCESS_SECRET || "service_secret_key";
      const servicePayload = jwt.verify(token, serviceSecret) as ServiceTokenPayload;

      req.service = {
        clientId: servicePayload.sub,
        scope: servicePayload.scope,
      };
      req.authType = "service";
    } else if (isUserToken) {
      // Verify user token
      const userSecret = process.env.JWT_SECRET || "access_secret_key";
      const userPayload = jwt.verify(token, userSecret) as UserTokenPayload;

      req.user = {
        userId: userPayload.userId,
        role: userPayload.role,
        email: userPayload.email,
      };
      req.authType = "user";
    } else {
      throw new UnauthorizedError("Unknown token type");
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError("Invalid token"));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError("Token expired"));
    } else {
      next(error);
    }
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("Not authenticated"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new UnauthorizedError("Insufficient permissions"));
    }

    next();
  };
};
