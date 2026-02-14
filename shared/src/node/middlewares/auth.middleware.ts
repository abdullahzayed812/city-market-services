import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../../utils/errors.js";
import { UserRole } from "../../enums/roles.js";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      throw new UnauthorizedError("No token provided");
    }

    const secret = process.env.JWT_SECRET || "access_secret_key";
    const decoded = jwt?.verify(token, secret) as any;
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    next(new UnauthorizedError("Invalid token"));
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("Not authenticated"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new UnauthorizedError("Insufficient permissions"));
    }

    next();
  };
};
