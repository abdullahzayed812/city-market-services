import { Request, Response, NextFunction } from "express";
import { AppError } from "@city-market/shared";
import { ApiResponse } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { DownstreamError } from "../../infrastructure/http/clients/CatalogClient";

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof DownstreamError) {
    return res.status(err.statusCode).json(err.body);
  }

  if (err instanceof AppError) {
    Logger.warn("Operational error", { message: err.message, statusCode: err.statusCode });
    return res.status(err.statusCode).json(ApiResponse.error(err.message));
  }

  Logger.error("Unexpected error", err);
  res.status(500).json(ApiResponse.error("Internal server error"));
};
