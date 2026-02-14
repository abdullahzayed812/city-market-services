import { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/errors.js";
import { ApiResponse } from "../../utils/response.js";
import { Logger } from "../utils/logger.js";

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
        Logger.warn("Operational error", { message: err.message, statusCode: err.statusCode });
        return res.status(err.statusCode).json(ApiResponse.error(err.message));
    }

    Logger.error("Unexpected error", err);
    res.status(500).json(ApiResponse.error("Internal server error"));
};
