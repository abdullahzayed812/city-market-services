import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { Logger } from "../utils/logger.js";
import { ApiResponse } from "../../utils/response.js";

let redis: Redis | null = null;
const getRedis = () => {
  if (!redis) redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  return redis;
};

export const idempotency = (ttlSeconds = 86400) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers["x-idempotency-key"] as string;

    if (!key) {
      return next();
    }

    const redisKey = `idempotency:${req.method}:${req.path}:${key}`;

    try {
      const cachedResponse = await getRedis().get(redisKey);

      if (cachedResponse) {
        const { status, body } = JSON.parse(cachedResponse);
        if (status === "PROCESSING") {
          return res.status(409).json(ApiResponse.error("request_already_processing"));
        }
        Logger.info(`Idempotency hit for key: ${key}`);
        return res.status(200).json(body);
      }

      // Mark as processing
      await getRedis().set(redisKey, JSON.stringify({ status: "PROCESSING" }), "EX", 60);

      // Intercept res.json to cache the final response
      const originalJson = res.json;
      res.json = function (body: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          getRedis().set(
            redisKey,
            JSON.stringify({ status: "COMPLETED", body }),
            "EX",
            ttlSeconds
          ).catch(err => Logger.error("Failed to cache idempotency response", err));
        } else {
          // If request failed, remove the PROCESSING lock so it can be retried
          getRedis().del(redisKey).catch(err => Logger.error("Failed to delete idempotency lock", err));
        }
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      Logger.error("Idempotency middleware error", error);
      next();
    }
  };
};
