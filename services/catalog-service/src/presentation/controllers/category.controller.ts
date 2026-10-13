import { Request, Response, NextFunction } from "express";
import { CategoryService } from "../../application/services/category.service";
import { ApiResponse, UserRole, CategoryType, ForbiddenError } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";
import { resolveWritableVendorId, assertOwnStore } from "../middlewares/vendor-access";

export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRole = (req as any).user?.role || UserRole.ADMIN;
      // An approved merchant creates categories in their own store only
      const ownVendorId = await resolveWritableVendorId(req as AuthenticatedRequest);

      const category = await this.categoryService.createCategory(
        { ...req.body, vendorId: ownVendorId ?? req.body.vendorId },
        userRole
      );
      res.status(201).json(ApiResponse.success(category, "Category created"));
    } catch (error) {
      next(error);
    }
  };

  getGlobal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.categoryService.getGlobalCategories();
      res.json(ApiResponse.success(categories));
    } catch (error) {
      next(error);
    }
  };

  getVendor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendorId = req.params.vendorId;
      const categories = await this.categoryService.getVendorCategories(vendorId);
      res.json(ApiResponse.success(categories));
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.categoryService.getAllCategories();
      res.json(ApiResponse.success(categories));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await this.categoryService.getCategoryById(req.params.id);
      res.json(ApiResponse.success(category));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownVendorId = await this.assertCanWriteCategory(req);
      // A merchant can't move a category to another store or make it global
      const { vendorId: _v, type: _t, ...own } = req.body ?? {};
      await this.categoryService.updateCategory(req.params.id, ownVendorId ? own : req.body);
      res.json(ApiResponse.success(null, "Category updated"));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.assertCanWriteCategory(req);
      await this.categoryService.deleteCategory(req.params.id);
      res.json(ApiResponse.success(null, "Category deleted"));
    } catch (error) {
      next(error);
    }
  };

  updateIcon = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { iconUrl } = req.body as { iconUrl?: string };
      if (!iconUrl || typeof iconUrl !== "string") {
        throw new Error("icon_url_required");
      }
      await this.assertCanWriteCategory(req);
      await this.categoryService.updateCategoryIcon(req.params.id, iconUrl);
      res.json(ApiResponse.success({ iconUrl }, "category_icon_updated"));
    } catch (error) {
      next(error);
    }
  };

  // Merchants manage only their own store's categories; global ones are admin-only
  private async assertCanWriteCategory(req: Request): Promise<string | null> {
    const ownVendorId = await resolveWritableVendorId(req as AuthenticatedRequest);
    if (!ownVendorId) return null;
    const category = await this.categoryService.getCategoryById(req.params.id);
    if (category.type !== CategoryType.VENDOR) throw new ForbiddenError("not_your_store");
    assertOwnStore(ownVendorId, category.vendorId);
    return ownVendorId;
  }
}
