import { Response, NextFunction } from "express";
import { CatalogService } from "../../application/services/catalog.service";
import { ApiResponse, ValidationError } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class VendorProductController {
  constructor(private catalogService: CatalogService) {}

  getAll = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const globalCategoryId = (req.query.globalCategoryId as string) || (req.query.categoryId as string);
      const vendorCategoryId = req.query.vendorCategoryId as string;
      const vendorId = req.query.vendorId as string;

      const { products, total } = await this.catalogService.getAllVendorProducts(
        page,
        limit,
        globalCategoryId,
        vendorCategoryId,
        vendorId,
      );
      res.json(
        ApiResponse.success({
          data: products,
          total,
          page,
          limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const product = await this.catalogService.createVendorProduct(req.body);
      Logger.info("Vendor product created", { productId: product.id });
      res.status(201).json(ApiResponse.success(product, "vendor_product_created"));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const product = await this.catalogService.getVendorProductById(req.params.id);
      res.json(ApiResponse.success(product));
    } catch (error) {
      next(error);
    }
  };

  getByVendor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { products, total } = await this.catalogService.getVendorProductsByVendor(req.params.vendorId, page, limit);
      res.json(
        ApiResponse.success({
          data: products,
          total,
          page,
          limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  getByCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { products, total } = await this.catalogService.getVendorProductsByCategory(
        req.params.categoryId,
        page,
        limit,
      );
      res.json(
        ApiResponse.success({
          data: products,
          total,
          page,
          limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  search = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filter = {
        vendorId: req.query.vendorId as string,
        globalCategoryId: (req.query.globalCategoryId as string) || (req.query.categoryId as string),
        vendorCategoryId: req.query.vendorCategoryId as string,
        search: req.query.search as string,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        available: req.query.available === "true" ? true : req.query.available === "false" ? false : undefined,
      };
      const { products, total } = await this.catalogService.searchVendorProducts(filter, page, limit);
      res.json(
        ApiResponse.success({
          data: products,
          total,
          page,
          limit,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.catalogService.updateVendorProduct(req.params.id, req.body);
      res.json(ApiResponse.success(null, "vendor_product_updated"));
    } catch (error) {
      next(error);
    }
  };

  updateStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.catalogService.updateVendorStock(req.params.id, req.body.stock);
      res.json(ApiResponse.success(null, "vendor_stock_updated"));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.catalogService.deleteVendorProduct(req.params.id);
      res.json(ApiResponse.success(null, "vendor_product_deleted"));
    } catch (error) {
      next(error);
    }
  };

  uploadImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ValidationError("no_image_file_provided");
      }
      const imageUrl = `/catalog/uploads/products/${req.file.filename}`;
      await this.catalogService.updateVendorProductImage(req.params.id, imageUrl);
      res.json(ApiResponse.success({ imageUrl }, "vendor_product_image_uploaded"));
    } catch (error) {
      next(error);
    }
  };
}
