import { Response, NextFunction } from "express"; // Removed Request
import { AdminService } from "../../application/services/admin.service";
import { ApiResponse } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";
import FormData from "form-data";

export class AdminController {
  constructor(private adminService: AdminService) {}

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

  updateVendorCommission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { vendorId } = req.params;
      const { rate } = req.body;
      const result = await this.adminService.updateVendorCommission(vendorId, rate, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  suspendVendor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Removed: const token = req.headers.authorization?.split(" ')[1];
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

  uploadVendorImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new Error("No file uploaded");
      }

      const formData = new FormData();
      formData.append("image", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      const result = await this.adminService.uploadVendorImage(req.params.id, formData, req.user!.userId);
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

  getRevenue = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const revenue = await this.adminService.getRevenue(req.user!.userId);
      res.json(revenue);
    } catch (error) {
      next(error);
    }
  };

  getPayouts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const payouts = await this.adminService.getPayouts(req.user!.userId);
      res.json(payouts);
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

  uploadCategoryIcon = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // We expect the icon to be passed in the request. If we use multer, it will be in req.file.
      // We need to forward it to catalog-service.
      if (!req.file) {
        throw new Error("No file uploaded");
      }

      const formData = new FormData();
      formData.append("icon", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      const result = await this.adminService.uploadCategoryIcon(req.params.id, formData, req.user!.userId);
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
      const globalCategoryId = req.query.globalCategoryId as string || req.query.categoryId as string;
      const vendorCategoryId = req.query.vendorCategoryId as string;
      
      const result = await this.adminService.getAllProducts(page, limit, req.user!.userId, globalCategoryId, vendorCategoryId);
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

  uploadProductImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new Error("No file uploaded");
      }

      const formData = new FormData();
      formData.append("image", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      const result = await this.adminService.uploadProductImage(req.params.id, formData, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
