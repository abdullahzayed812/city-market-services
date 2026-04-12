import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "../utils/logger.js";

export const correlation = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers["x-correlation-id"] as string) || uuidv4();

  // Propagate to response headers
  res.setHeader("X-Correlation-ID", correlationId);

  const context = new Map<string, string>();
  context.set("correlationId", correlationId);

  Logger.runWithContext(context, () => {
    next();
  });
};
