import { Response, NextFunction } from "express";
import { OrderService } from "../../application/services/order.service";
import { ApiResponse, ProposeChangesDto, UserRole, ValidationError } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { AuthenticatedRequest } from "@city-market/shared/node";
import { resolveOwnVendorId, assertOwnStore, assertCustomerOrderAccess } from "../middlewares/vendor-access";

export class OrderController {
  constructor(private orderService: OrderService) {}

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dto = { ...req.body, customerId: req.user?.userId };
      const order = await this.orderService.createOrder(dto, req.user?.userId);
      Logger.info("Customer order created", { customerOrderId: order.order.id });
      res.status(201).json(ApiResponse.success(order, "order_created"));
    } catch (error) {
      next(error);
    }
  };

  getStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await this.orderService.getOrderStats();
      res.json(ApiResponse.success(stats));
    } catch (error) {
      next(error);
    }
  };

  getVendorOrderById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.assertVendorOrderAccess(req);
      const order = await this.orderService.getVendorOrderById(req.params.id, req.user?.userId);
      res.json(ApiResponse.success(order));
    } catch (error) {
      next(error);
    }
  };

  acceptVendorOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.assertVendorOrderAccess(req);
      await this.orderService.acceptVendorOrder(req.params.id);
      res.json(ApiResponse.success(null, "vendor_order_accepted"));
    } catch (error) {
      next(error);
    }
  };

  proposeChanges = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.assertVendorOrderAccess(req);
      await this.orderService.proposeChanges(req.params.id, req.body.proposals as ProposeChangesDto[]);
      res.json(ApiResponse.success(null, "changes_proposed"));
    } catch (error) {
      next(error);
    }
  };

  updateVendorOrderStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.assertVendorOrderAccess(req);
      const { status, notes } = req.body;
      await this.orderService.updateVendorOrderStatus(req.params.id, status, notes, false);
      res.json(ApiResponse.success(null, "vendor_order_status_updated"));
    } catch (error) {
      next(error);
    }
  };

  acceptProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      assertCustomerOrderAccess(req, await this.orderService.getProposalOwnerId(req.params.id), "proposal_not_found");
      await this.orderService.acceptProposal(req.params.id);
      res.json(ApiResponse.success(null, "proposal_accepted"));
    } catch (error) {
      next(error);
    }
  };

  rejectProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      assertCustomerOrderAccess(req, await this.orderService.getProposalOwnerId(req.params.id), "proposal_not_found");
      await this.orderService.rejectProposal(req.params.id, req.body.cancelEntireOrder);
      res.json(ApiResponse.success(null, "proposal_rejected"));
    } catch (error) {
      next(error);
    }
  };

  getMyOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const orders = await this.orderService.getCustomerOrders(req.user?.userId || "", page, limit);
      res.json(ApiResponse.success(orders));
    } catch (error) {
      next(error);
    }
  };

  getCustomerOrderById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      assertCustomerOrderAccess(req, await this.orderService.getCustomerOrderOwnerId(req.params.id));
      // Admin apps reach this through admin-service, which calls with its own service token
      const forAdmin = req.user?.role === UserRole.ADMIN || (req.authType === "service" && req.service?.scope === "admin");
      const order = await this.orderService.getCustomerOrderById(req.params.id, req.user?.userId, forAdmin);
      res.json(ApiResponse.success(order));
    } catch (error) {
      next(error);
    }
  };

  getCustomerOrdersBatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ids = req.body?.ids;
      if (!Array.isArray(ids) || ids.length > 200 || !ids.every((id) => typeof id === "string")) {
        throw new ValidationError("invalid_ids");
      }
      const orders = await this.orderService.getCustomerOrdersByIds(ids, req.user?.userId);
      res.json(ApiResponse.success(orders));
    } catch (error) {
      next(error);
    }
  };

  getOrderProposals = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      assertCustomerOrderAccess(req, await this.orderService.getCustomerOrderOwnerId(req.params.id));
      const proposals = await this.orderService.getOrderProposals(req.params.id);
      res.json(ApiResponse.success(proposals));
    } catch (error) {
      next(error);
    }
  };

  resolveVendorCancellation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      assertCustomerOrderAccess(req, await this.orderService.getCustomerOrderOwnerId(req.params.id));
      await this.orderService.resolveVendorCancellation(req.params.id, req.body.continueOrder);
      res.json(ApiResponse.success(null, "vendor_cancellation_resolved"));
    } catch (error) {
      next(error);
    }
  };

  getVendorOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      assertOwnStore(await resolveOwnVendorId(req), req.params.vendorId);
      const orders = await this.orderService.getVendorOrders(req.params.vendorId, page, limit);
      res.json(ApiResponse.success(orders));
    } catch (error) {
      next(error);
    }
  };

  getVendorFinancials = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      assertOwnStore(await resolveOwnVendorId(req), req.params.vendorId);
      const periodStart = req.query.periodStart ? new Date(req.query.periodStart as string) : undefined;
      const periodEnd = req.query.periodEnd ? new Date(req.query.periodEnd as string) : undefined;
      const financials = await this.orderService.getVendorFinancials(req.params.vendorId, periodStart, periodEnd);
      res.json(ApiResponse.success(financials));
    } catch (error) {
      next(error);
    }
  };

  getAllOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 200);
      const date = (v: unknown) => (typeof v === "string" && v ? new Date(v) : undefined);
      const orders = await this.orderService.getAllOrders(page, limit, {
        status: (req.query.status as string) || undefined,
        search: ((req.query.search as string) || "").replace(/^#/, "").trim() || undefined,
        createdFrom: date(req.query.from),
        createdTo: date(req.query.to),
      });
      res.json(ApiResponse.success(orders));
    } catch (error) {
      next(error);
    }
  };

  updateCustomerOrderStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status, notes } = req.body;
      await this.orderService.updateCustomerOrderStatus(req.params.id, status, notes);
      res.json(ApiResponse.success(null, "customer_order_status_updated"));
    } catch (error) {
      next(error);
    }
  };

  getDeliveryFeePreview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { lat, lng, vendorIds } = req.query;
      if (!lat || !lng || !vendorIds) {
        throw new ValidationError("missing_required_params");
      }

      const vendorIdArray = (vendorIds as string).split(",");
      const fee = await this.orderService.calculateDeliveryFee(parseFloat(lat as string), parseFloat(lng as string), vendorIdArray);

      res.json(ApiResponse.success({ deliveryFee: fee }));
    } catch (error) {
      next(error);
    }
  };

  // Merchant-only order actions: an approved merchant on their own store's vendor order,
  // or an admin / service. The vendor order id in the URL is never trusted on its own.
  private async assertVendorOrderAccess(req: AuthenticatedRequest): Promise<void> {
    const ownVendorId = await resolveOwnVendorId(req);
    if (!ownVendorId) return;
    assertOwnStore(ownVendorId, await this.orderService.getVendorOrderVendorId(req.params.id));
  }
}
