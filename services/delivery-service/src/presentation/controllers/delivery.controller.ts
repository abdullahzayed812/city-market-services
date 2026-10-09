import { Response, NextFunction } from "express";
import { Actor, DeliveryService } from "../../application/services/delivery.service";
import { ApiResponse, UserRole } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { AuthenticatedRequest } from "@city-market/shared/node";
import { CourierListFilter } from "../../core/interfaces/courier.repository";

// authorize() already rejected unauthenticated requests; a request without a user here
// is a service token, which acts as ADMIN (same convention as the settlement controllers).
export const getActor = (req: AuthenticatedRequest): Actor =>
  req.user ? { userId: req.user.userId, role: req.user.role } : { userId: req.headers["x-user-id"] as string | undefined, role: UserRole.ADMIN };

const courierFilter = (req: AuthenticatedRequest): CourierListFilter => ({
  courierType: (req.query.courierType as CourierListFilter["courierType"]) || undefined,
  approvalStatus: (req.query.approvalStatus as CourierListFilter["approvalStatus"]) || undefined,
  search: ((req.query.search as string) || "").trim() || undefined,
  isActive: req.query.status === "active" ? true : req.query.status === "inactive" ? false : undefined,
});

export class DeliveryController {
  constructor(private deliveryService: DeliveryService) {}

  // Courier management
  registerCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courier = await this.deliveryService.registerCourier(req.body, getActor(req));
      Logger.info("Courier registered", { courierId: courier.id });
      res.status(201).json(ApiResponse.success(courier, "courier_registered"));
    } catch (error) {
      next(error);
    }
  };

  createOfficeCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courier = await this.deliveryService.createOfficeCourier(req.user!.userId, req.body ?? {});
      res.status(201).json(ApiResponse.success(courier, "courier_request_submitted"));
    } catch (error) {
      next(error);
    }
  };

  registerFreelancer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courier = await this.deliveryService.registerFreelancer(req.user!.userId, req.body);
      Logger.info("Freelance courier signed up", { courierId: courier.id });
      res.status(201).json(ApiResponse.success(courier, "freelancer_registered_pending_review"));
    } catch (error) {
      next(error);
    }
  };

  getAllCouriers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const couriers = await this.deliveryService.getAllCouriers(page, limit, getActor(req), courierFilter(req));
      res.json(ApiResponse.success(couriers));
    } catch (error) {
      next(error);
    }
  };

  getCouriersCount = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const total = await this.deliveryService.countCouriers(courierFilter(req));
      res.json(ApiResponse.success({ total }));
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
      const couriers = await this.deliveryService.getAvailableCouriers(getActor(req));
      res.json(ApiResponse.success(couriers));
    } catch (error) {
      next(error);
    }
  };

  getCourierDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(ApiResponse.success(await this.deliveryService.getCourierDetails(req.params.id, getActor(req))));
    } catch (error) {
      next(error);
    }
  };

  getCourierDetailsByUserId = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(ApiResponse.success(await this.deliveryService.getCourierDetailsByUserId(req.params.userId, getActor(req))));
    } catch (error) {
      next(error);
    }
  };

  registerOffice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const office = await this.deliveryService.registerOffice(req.user!.userId, req.body ?? {});
      res.status(201).json(ApiResponse.success(office, "office_registered_pending_review"));
    } catch (error) {
      next(error);
    }
  };

  createOfficeByAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const office = await this.deliveryService.createOfficeByAdmin(req.body ?? {});
      res.status(201).json(ApiResponse.success(office, "office_created"));
    } catch (error) {
      next(error);
    }
  };

  setOfficeApproval = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.setOfficeApproval(req.params.id, req.body?.approvalStatus);
      res.json(ApiResponse.success(null, "office_approval_updated"));
    } catch (error) {
      next(error);
    }
  };

  getOfficeDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(ApiResponse.success(await this.deliveryService.getOfficeDetails(req.params.id)));
    } catch (error) {
      next(error);
    }
  };

  listOffices = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || "50"), 200);
      const offset = parseInt((req.query.offset as string) || "0");
      const status = req.query.approvalStatus as "PENDING_REVIEW" | "APPROVED" | "SUSPENDED" | undefined;
      res.json(ApiResponse.success(await this.deliveryService.listOffices(limit, offset, status || undefined)));
    } catch (error) {
      next(error);
    }
  };

  updateCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.updateCourier(req.params.id, req.body, getActor(req));
      res.json(ApiResponse.success(null, "courier_updated"));
    } catch (error) {
      next(error);
    }
  };

  updateAvailability = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.updateCourierAvailability(req.params.id, req.body.isAvailable, getActor(req));
      res.json(ApiResponse.success(null, "availability_updated"));
    } catch (error) {
      next(error);
    }
  };

  updateMyAvailability = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courier = await this.deliveryService.getCourierByUserId(req.user!.userId);
      await this.deliveryService.updateCourierAvailability(courier.id, req.body.isAvailable, getActor(req));
      res.json(ApiResponse.success(null, "availability_updated"));
    } catch (error) {
      next(error);
    }
  };

  updateMyLocation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.updateMyLocation(req.user!.userId, req.body);
      res.json(ApiResponse.success(null, "location_updated"));
    } catch (error) {
      next(error);
    }
  };

  deactivateCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.deactivateCourier(req.params.id, getActor(req));
      res.json(ApiResponse.success(null, "courier_deactivated"));
    } catch (error) {
      next(error);
    }
  };

  setCourierApproval = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.setCourierApproval(req.params.id, req.body.approvalStatus);
      res.json(ApiResponse.success(null, "courier_approval_updated"));
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
      const delivery = await this.deliveryService.getDeliveryById(req.params.id, getActor(req));
      res.json(ApiResponse.success(delivery));
    } catch (error) {
      next(error);
    }
  };

  getOrderCouriers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const couriers = await this.deliveryService.getOrderCouriersForCustomer(req.params.customerOrderId, req.user!.userId);
      res.json(ApiResponse.success(couriers));
    } catch (error) {
      next(error);
    }
  };

  rateDelivery = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.rateDelivery(req.params.id, req.user!.userId, req.body ?? {});
      res.status(201).json(ApiResponse.success(null, "delivery_rated"));
    } catch (error) {
      next(error);
    }
  };

  getDeliveryRatings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const result = await this.deliveryService.getDeliveryRatings(
        getActor(req),
        { courierId: req.query.courierId as string | undefined, deliveryOfficeId: req.query.deliveryOfficeId as string | undefined },
        page,
        limit,
      );
      res.json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  };

  getPendingDeliveries = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const deliveries = await this.deliveryService.getPendingDeliveries(page, limit, getActor(req));
      res.json(ApiResponse.success(deliveries));
    } catch (error) {
      next(error);
    }
  };

  getFreelancePool = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const deliveries = await this.deliveryService.getFreelancePool(req.user!.userId, page, limit);
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

  acceptDelivery = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.acceptDelivery(req.params.id, req.user!.userId);
      res.json(ApiResponse.success(null, "delivery_accepted"));
    } catch (error) {
      next(error);
    }
  };

  claimDelivery = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.claimDelivery(req.params.id, req.user!.userId);
      res.json(ApiResponse.success(null, "delivery_claimed"));
    } catch (error) {
      next(error);
    }
  };

  assignCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.assignCourier(req.params.id, req.body, getActor(req));
      res.json(ApiResponse.success(null, "courier_assigned"));
    } catch (error) {
      next(error);
    }
  };

  updateDeliveryStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.updateDeliveryStatus(req.params.id, req.body, getActor(req));
      res.json(ApiResponse.success(null, "delivery_status_updated"));
    } catch (error) {
      next(error);
    }
  };

  cancelDeliveryByCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courier = await this.deliveryService.getCourierByUserId(req.user!.userId);
      await this.deliveryService.cancelDeliveryByCourier(req.params.id, courier.id, req.body.reason);
      res.json(ApiResponse.success(null, "delivery_cancelled"));
    } catch (error) {
      next(error);
    }
  };

  releaseDeliveryByCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.releaseDeliveryByCourier(req.params.id, req.user!.userId, req.body?.reason);
      res.json(ApiResponse.success(null, "delivery_released"));
    } catch (error) {
      next(error);
    }
  };

  cancelDeliveryByManager = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.deliveryService.cancelDeliveryByManager(req.params.id, req.user!.userId, req.body.reason);
      res.json(ApiResponse.success(null, "delivery_cancelled"));
    } catch (error) {
      next(error);
    }
  };

  getAllDeliveries = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const deliveries = await this.deliveryService.getAllDeliveries(page, limit, getActor(req));
      res.json(ApiResponse.success(deliveries));
    } catch (error) {
      next(error);
    }
  };

  getFinancialAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const vendorOrderIdsStr = req.query.vendorOrderIds as string;
      const vendorOrderIds = vendorOrderIdsStr ? vendorOrderIdsStr.split(",") : [];
      const periodStart = req.query.periodStart ? new Date(req.query.periodStart as string) : undefined;
      const periodEnd = req.query.periodEnd ? new Date(req.query.periodEnd as string) : undefined;

      const count = await this.deliveryService.getVendorDeliveriesCount(vendorOrderIds, periodStart, periodEnd);
      res.json(ApiResponse.success({ totalDeliveries: count }));
    } catch (error) {
      next(error);
    }
  };
}
