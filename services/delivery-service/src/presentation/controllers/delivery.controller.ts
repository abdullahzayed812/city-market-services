import { Response, NextFunction } from "express";
import { DeliveryService } from "../../application/services/delivery.service";
import { ApiResponse } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class DeliveryController {
  constructor(private deliveryService: DeliveryService) { }

  // Courier management
  registerCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dto = { ...req.body, userId: req.user!.userId };
      const courier = await this.deliveryService.registerCourier(dto);
      Logger.info("Courier registered", { courierId: courier.id });
      res.status(201).json(ApiResponse.success(courier, "courier_registered"));
    } catch (error) {
      next(error);
    }
  };

  getAllCouriers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const couriers = await this.deliveryService.getAllCouriers(page, limit);
      res.json(ApiResponse.success(couriers));
    } catch (error) {
      next(error);
    }
  };

  getMyCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courier = await this.deliveryService.getCourierByUserId(req.user!.userId);
      res.json(ApiResponse.success(courier));
    } catch (error) {
      next(error);
    }
  };

  getAvailableCouriers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const couriers = await this.deliveryService.getAvailableCouriers();
      res.json(ApiResponse.success(couriers));
    } catch (error) {
      next(error);
    }
  };

  updateCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.updateCourier(req.params.id, req.body);
      res.json(ApiResponse.success(null, "courier_updated"));
    } catch (error) {
      next(error);
    }
  };

  updateAvailability = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.updateCourierAvailability(req.params.id, req.body.isAvailable);
      res.json(ApiResponse.success(null, "availability_updated"));
    } catch (error) {
      next(error);
    }
  };

  // Delivery management
  createDelivery = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const delivery = await this.deliveryService.createDelivery(req.body);
      res.status(201).json(ApiResponse.success(delivery, "delivery_created"));
    } catch (error) {
      next(error);
    }
  };

  getDeliveryById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const delivery = await this.deliveryService.getDeliveryById(req.params.id, req.user?.userId);
      res.json(ApiResponse.success(delivery));
    } catch (error) {
      next(error);
    }
  };

  getPendingDeliveries = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const deliveries = await this.deliveryService.getPendingDeliveries(req.user?.userId);
      res.json(ApiResponse.success(deliveries));
    } catch (error) {
      next(error);
    }
  };

  getMyCourierDeliveries = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courier = await this.deliveryService.getCourierByUserId(req.user!.userId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const deliveries = await this.deliveryService.getCourierDeliveries(courier.id, page, limit, req.user?.userId);
      res.json(ApiResponse.success(deliveries));
    } catch (error) {
      next(error);
    }
  };

  assignCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.assignCourier(req.params.id, req.body);
      res.json(ApiResponse.success(null, "courier_assigned"));
    } catch (error) {
      next(error);
    }
  };

  updateDeliveryStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.updateDeliveryStatus(req.params.id, req.body);
      res.json(ApiResponse.success(null, "delivery_status_updated"));
    } catch (error) {
      next(error);
    }
  };

  getAllDeliveries = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const deliveries = await this.deliveryService.getAllDeliveries(page, limit, req.user?.userId);
      res.json(ApiResponse.success(deliveries));
    } catch (error) {
      next(error);
    }
  };
}
