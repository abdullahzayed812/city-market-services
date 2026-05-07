import { Response, NextFunction } from "express";
import { VendorService } from "../../application/services/vendor.service";
import { ApiResponse, ValidationError } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class VendorController {
  constructor(private vendorService: VendorService) {}

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.body.userId || req.user?.userId;
      const dto = { ...req.body, userId };
      const vendor = await this.vendorService.createVendor(dto);
      Logger.info("Vendor created", { vendorId: vendor.id });
      res.status(201).json(ApiResponse.success(vendor, "vendor_created"));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const vendor = await this.vendorService.getVendorById(req.params.id);
      res.json(ApiResponse.success(vendor));
    } catch (error) {
      next(error);
    }
  };

  getMyVendor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const vendor = await this.vendorService.getVendorByUserId(req.user!.userId);
      res.json(ApiResponse.success(vendor));
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const vendors = await this.vendorService.getAllVendors(page, limit);
      res.json(ApiResponse.success(vendors));
    } catch (error) {
      next(error);
    }
  };

  getByIds = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        throw new ValidationError("ids_must_be_an_array");
      }
      const vendors = await this.vendorService.getVendorsByIds(ids);
      res.json(ApiResponse.success(vendors));
    } catch (error) {
      next(error);
    }
  };

  getOpen = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const vendors = await this.vendorService.getOpenVendors();
      res.json(ApiResponse.success(vendors));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.vendorService.updateVendor(req.params.id, req.body);
      res.json(ApiResponse.success(null, "vendor_updated"));
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.vendorService.updateVendorStatus(req.params.id, req.body.status);
      res.json(ApiResponse.success(null, "status_updated"));
    } catch (error) {
      next(error);
    }
  };

  setWorkingHours = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.vendorService.setWorkingHours(req.params.id, req.body);
      res.json(ApiResponse.success(null, "working_hours_set"));
    } catch (error) {
      next(error);
    }
  };

  getWorkingHours = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const hours = await this.vendorService.getWorkingHours(req.params.id);
      res.json(ApiResponse.success(hours));
    } catch (error) {
      next(error);
    }
  };

  updateImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { imageUrl } = req.body as { imageUrl?: string };
      if (!imageUrl || typeof imageUrl !== "string") {
        throw new ValidationError("image_url_required");
      }
      await this.vendorService.updateStoreImage(req.params.id, imageUrl);
      res.json(ApiResponse.success({ imageUrl }, "store_image_updated"));
    } catch (error) {
      next(error);
    }
  };
}
