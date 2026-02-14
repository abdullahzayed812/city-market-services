import { Response, NextFunction } from "express";
import { OrderService } from "../../application/services/order.service";
import { ApiResponse } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { AuthRequest } from "@city-market/shared/node";

export class OrderController {
  constructor(private orderService: OrderService) {}

  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      const dto = { ...req.body, customerId: req.user!.userId };
      const order = await this.orderService.createOrder(dto, token);
      Logger.info("Customer order created", { customerOrderId: order.order.id });
      res.status(201).json(ApiResponse.success(order, "Order created"));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      const order = await this.orderService.getOrderById(req.params.id, token);
      res.json(ApiResponse.success(order));
    } catch (error) {
      next(error);
    }
  };

  getVendorOrderById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      const order = await this.orderService.getVendorOrderById(req.params.id, token);
      res.json(ApiResponse.success(order));
    } catch (error) {
      next(error);
    }
  };

  acceptVendorOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.orderService.acceptVendorOrder(req.params.id);
      res.json(ApiResponse.success(null, "Vendor order accepted"));
    } catch (error) {
      next(error);
    }
  };

  proposeChanges = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.orderService.proposeChanges(req.params.id, req.body);
      res.json(ApiResponse.success(null, "Changes proposed"));
    } catch (error) {
      next(error);
    }
  };

  updateVendorOrderStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.orderService.updateVendorOrderStatus(req.params.id, req.body.status, req.body.notes);
      res.json(ApiResponse.success(null, "Vendor order status updated"));
    } catch (error) {
      next(error);
    }
  };

  acceptProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.orderService.acceptProposal(req.params.id);
      res.json(ApiResponse.success(null, "Proposal accepted"));
    } catch (error) {
      next(error);
    }
  };

  rejectProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.orderService.rejectProposal(req.params.id, req.body.cancelEntireOrder);
      res.json(ApiResponse.success(null, "Proposal rejected"));
    } catch (error) {
      next(error);
    }
  };

  getMyOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const orders = await this.orderService.getCustomerOrders(req.user!.userId, page, limit);
      res.json(ApiResponse.success(orders));
    } catch (error) {
      next(error);
    }
  };

  getVendorOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const orders = await this.orderService.getVendorOrders(req.params.vendorId, page, limit);
      res.json(ApiResponse.success(orders));
    } catch (error) {
      next(error);
    }
  };

  getAllOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const orders = await this.orderService.getAllOrders(page, limit);
      res.json(ApiResponse.success(orders));
    } catch (error) {
      next(error);
    }
  };

  updateCustomerOrderStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status, notes } = req.body;
      await this.orderService.updateCustomerOrderStatus(req.params.id, status, notes);
      res.json(ApiResponse.success(null, "Customer order status updated"));
    } catch (error) {
      next(error);
    }
  };
}
