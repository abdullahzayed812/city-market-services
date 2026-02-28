import { Request, Response, NextFunction } from "express";
import { CategoryService } from "../../application/services/category.service";
import { ApiResponse, UserRole } from "@city-market/shared";

export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // In a real app, role and userId/vendorId would be in req.user
      const userRole = (req as any).user?.role || UserRole.ADMIN;
      const vendorId = (req as any).user?.vendorId; // Assuming vendorId is extracted from token

      const category = await this.categoryService.createCategory(
        { ...req.body, vendorId: req.body.vendorId || vendorId },
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
      await this.categoryService.updateCategory(req.params.id, req.body);
      res.json(ApiResponse.success(null, "Category updated"));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.categoryService.deleteCategory(req.params.id);
      res.json(ApiResponse.success(null, "Category deleted"));
    } catch (error) {
      next(error);
    }
  };

  uploadIcon = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new Error("No SVG file provided");
      }
      const iconUrl = `/catalog/uploads/categories/icons/${req.file.filename}`;
      await this.categoryService.updateCategoryIcon(req.params.id, iconUrl);
      res.json(ApiResponse.success({ iconUrl }, "Category icon uploaded"));
    } catch (error) {
      next(error);
    }
  };
}
