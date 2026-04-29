import { Request, Response, NextFunction } from "express";
import { ValidationError } from "@city-market/shared";

export const createRatingValidator = (req: Request, res: Response, next: NextFunction) => {
  const { orderId, vendorId, stars, comment } = req.body;

  if (!orderId || typeof orderId !== "string") {
    return next(new ValidationError("order_id_required"));
  }

  if (!vendorId || typeof vendorId !== "string") {
    return next(new ValidationError("vendor_id_required"));
  }

  if (!stars || typeof stars !== "number" || stars < 1 || stars > 5) {
    return next(new ValidationError("invalid_stars_value"));
  }

  if (comment && typeof comment !== "string") {
    return next(new ValidationError("invalid_comment_format"));
  }

  next();
};
