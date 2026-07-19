import { Response, NextFunction } from "express";
import { AdminService } from "../../application/services/admin.service";
import { ApiResponse } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class AdminController {
  constructor(private adminService: AdminService) { }

  getDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await this.adminService.getDashboardStats(req.user!.userId);
      res.json(ApiResponse.success(stats));
    } catch (error) {
      next(error);
    }
  };

  getAllOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const orders = await this.adminService.getAllOrders(page, limit, req.user!.userId);
      res.json(orders);
    } catch (error) {
      next(error);
    }
  };

  getAllVendors = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const vendors = await this.adminService.getAllVendors(page, limit, req.user!.userId);
      res.json(vendors);
    } catch (error) {
      next(error);
    }
  };

  suspendVendor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { vendorId } = req.params;
      const result = await this.adminService.suspendVendor(vendorId, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getAllCouriers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const couriers = await this.adminService.getAllCouriers(page, limit, req.user!.userId);
      res.json(couriers);
    } catch (error) {
      next(error);
    }
  };

  deactivateCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { courierId } = req.params;
      const result = await this.adminService.deactivateCourier(courierId, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getAllUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const role = req.query.role as string;
      const users = await this.adminService.getAllUsers(page, limit, req.user!.userId, role);
      res.json(users);
    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await this.adminService.getUserById(id, req.user!.userId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  updateUserStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await this.adminService.updateUserStatus(id, status, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getVendorById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const vendor = await this.adminService.getVendorById(id, req.user!.userId);
      res.json(vendor);
    } catch (error) {
      next(error);
    }
  };

  updateVendor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.adminService.updateVendor(id, req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  updateVendorStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await this.adminService.updateVendorStatus(id, status, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  updateVendorImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { imageUrl } = req.body as { imageUrl?: string };
      if (!imageUrl || typeof imageUrl !== "string") throw new Error("imageUrl is required");
      const result = await this.adminService.updateVendorImage(req.params.id, imageUrl, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getOrderById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const order = await this.adminService.getOrderById(id, req.user!.userId);
      res.json(order);
    } catch (error) {
      next(error);
    }
  };

  updateOrderStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await this.adminService.updateOrderStatus(id, status, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getDeliveries = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const deliveries = await this.adminService.getDeliveries(req.user!.userId);
      res.json(deliveries);
    } catch (error) {
      next(error);
    }
  };

  getAvailableCouriers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const couriers = await this.adminService.getAvailableCouriers(req.user!.userId);
      res.json(couriers);
    } catch (error) {
      next(error);
    }
  };

  // getFinancialAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  //   try {
  //     const { vendorId } = req.params;
  //     const periodStart = req.query.periodStart as string;
  //     const periodEnd = req.query.periodEnd as string;

  //     const result = await this.adminService.getFinancialAnalytics(vendorId, periodStart, periodEnd, req.user!.userId);
  //     res.json(ApiResponse.success(result));
  //   } catch (error) {
  //     next(error);
  //   }
  // };

  // getRevenue = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  //   try {
  //     const revenue = await this.adminService.getRevenue(req.user!.userId);
  //     res.json(revenue);
  //   } catch (error) {
  //     next(error);
  //   }
  // };

  // getPayouts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  //   try {
  //     const payouts = await this.adminService.getPayouts(req.user!.userId);
  //     res.json(payouts);
  //   } catch (error) {
  //     next(error);
  //   }
  // };

  // Creation Management
  registerUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.registerUser(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createCourier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.createCourier(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createVendor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.createVendor(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // Category Management
  getAllCategories = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.getAllCategories(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.createCategory(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  updateCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.updateCategory(req.params.id, req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.deleteCategory(req.params.id, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  updateCategoryIcon = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { iconUrl } = req.body as { iconUrl?: string };
      if (!iconUrl || typeof iconUrl !== "string") throw new Error("iconUrl is required");
      const result = await this.adminService.updateCategoryIcon(req.params.id, iconUrl, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // Product Management
  getAllProducts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const globalCategoryId = (req.query.globalCategoryId as string) || (req.query.categoryId as string);
      const vendorCategoryId = req.query.vendorCategoryId as string;
      const vendorId = req.query.vendorId as string;
      const search = req.query.search as string;

      const result = await this.adminService.getAllProducts(
        page,
        limit,
        req.user!.userId,
        globalCategoryId,
        vendorCategoryId,
        vendorId,
        search,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.createProduct(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  updateProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.updateProduct(req.params.id, req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.deleteProduct(req.params.id, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  updateProductImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { imageUrl } = req.body as { imageUrl?: string };
      if (!imageUrl || typeof imageUrl !== "string") throw new Error("imageUrl is required");
      const result = await this.adminService.updateProductImage(req.params.id, imageUrl, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // Global Product Management
  getGlobalProducts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const result = await this.adminService.getGlobalProducts(page, limit, search, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createGlobalProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.createGlobalProduct(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  bulkCreateGlobalProducts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.bulkCreateGlobalProducts(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  updateGlobalProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.updateGlobalProduct(req.params.id, req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteGlobalProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.deleteGlobalProduct(req.params.id, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // Commission Tiers Management
  getAllCommissionTiers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.getAllCommissionTiers(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createCommissionTier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.createCommissionTier(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  updateCommissionTier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.updateCommissionTier(req.params.id, req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteCommissionTier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.deleteCommissionTier(req.params.id, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // Delivery Offices
  getAllDeliveryOffices = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.getAllDeliveryOffices(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // Courier Settlements
  getCourierPendingEarnings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.getCourierPendingEarnings(req.params.courierId, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getCourierSettlements = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courierId = req.query.courierId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const result = await this.adminService.getCourierSettlements(courierId, limit, offset, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createCourierSettlement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.createCourierSettlement(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  markCourierSettlementPaid = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.markCourierSettlementPaid(req.params.id, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // Office Settlements
  getOfficePendingEarnings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const deliveryOfficeId = req.query.deliveryOfficeId as string | undefined;
      const result = await this.adminService.getOfficePendingEarnings(deliveryOfficeId, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getOfficeSettlements = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const deliveryOfficeId = req.query.deliveryOfficeId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const result = await this.adminService.getOfficeSettlements(deliveryOfficeId, limit, offset, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createOfficeSettlement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.createOfficeSettlement(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  markOfficeSettlementPaid = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.markOfficeSettlementPaid(req.params.id, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // Delivery Fee Tiers
  getAllDeliveryFeeTiers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.getAllDeliveryFeeTiers(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createDeliveryFeeTier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.createDeliveryFeeTier(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  updateDeliveryFeeTier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.updateDeliveryFeeTier(req.params.id, req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteDeliveryFeeTier = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.deleteDeliveryFeeTier(req.params.id, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // Settlement Management
  getVendorPendingEarnings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.getVendorPendingEarnings(req.params.vendorId, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getSettlements = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const vendorId = req.query.vendorId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await this.adminService.getSettlements(vendorId, page, limit, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createSettlement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.createSettlement(req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  markSettlementPaid = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.markSettlementPaid(req.params.id, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getPlatformFinancialOverview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.getPlatformFinancialOverview(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
