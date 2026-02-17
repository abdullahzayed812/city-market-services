import { Response, NextFunction } from "express";
import { ProductService } from "../../application/services/product.service";
import { ApiResponse, ValidationError } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class ProductController {
  constructor(private productService: ProductService) {}

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const product = await this.productService.createProduct(req.body);
      Logger.info("Product created", { productId: product.id });
      res.status(201).json(ApiResponse.success(product, "Product created"));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const product = await this.productService.getProductById(req.params.id);
      res.json(ApiResponse.success(product));
    } catch (error) {
      next(error);
    }
  };

  getByVendor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const products = await this.productService.getProductsByVendor(req.params.vendorId, page, limit);
      res.json(ApiResponse.success(products));
    } catch (error) {
      next(error);
    }
  };

  getByCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const products = await this.productService.getProductsByCategory(req.params.categoryId, page, limit);
      res.json(ApiResponse.success(products));
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
        categoryId: req.query.categoryId as string,
        search: req.query.search as string,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        available: req.query.available === "true" ? true : req.query.available === "false" ? false : undefined,
      };
      const products = await this.productService.searchProducts(filter, page, limit);
      res.json(ApiResponse.success(products));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.productService.updateProduct(req.params.id, req.body);
      res.json(ApiResponse.success(null, "Product updated"));
    } catch (error) {
      next(error);
    }
  };

  updateStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.productService.updateStock(req.params.id, req.body.stock);
      res.json(ApiResponse.success(null, "Stock updated"));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.productService.deleteProduct(req.params.id);
      res.json(ApiResponse.success(null, "Product deleted"));
    } catch (error) {
      next(error);
    }
  };

  uploadImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ValidationError("No image file provided");
      }
      const imageUrl = `/catalog/uploads/products/${req.file.filename}`;
      await this.productService.updateProductImage(req.params.id, imageUrl);
      res.json(ApiResponse.success({ imageUrl }, "Product image uploaded"));
    } catch (error) {
      next(error);
    }
  };
}
