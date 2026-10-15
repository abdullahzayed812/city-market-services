import { Response, NextFunction } from "express";
import { AppError } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";

// Per-user fixed-window limit (in memory, per instance), on top of the per-IP limits in
// nginx / the gateway. Keyed by the signed-in user so one merchant can't flood storage.
export const userRateLimit = (maxRequests: number, windowMs: number) => {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const key = req.user?.userId ?? req.service?.clientId ?? req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      // Forget expired windows now and then
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
      return next();
    }
    if (entry.count >= maxRequests) return next(new AppError(429, "too_many_uploads"));
    entry.count++;
    next();
  };
};
