import { Response, NextFunction } from "express";
import { VendorService } from "../../application/services/vendor.service";
import { ApiResponse, ValidationError } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { AuthRequest } from "@city-market/shared/node";

export class VendorController {
  constructor(private vendorService: VendorService) { }

  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = { ...req.body, userId: req.user!.userId };
      const vendor = await this.vendorService.createVendor(dto);
      Logger.info("Vendor created", { vendorId: vendor.id });
      res.status(201).json(ApiResponse.success(vendor, "Vendor created"));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const vendor = await this.vendorService.getVendorById(req.params.id);
      res.json(ApiResponse.success(vendor));
    } catch (error) {
      next(error);
    }
  };

  getMyVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const vendor = await this.vendorService.getVendorByUserId(req.user!.userId);
      res.json(ApiResponse.success(vendor));
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const vendors = await this.vendorService.getAllVendors(page, limit);
      res.json(ApiResponse.success(vendors));
    } catch (error) {
      next(error);
    }
  };

  getOpen = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const vendors = await this.vendorService.getOpenVendors();
      res.json(ApiResponse.success(vendors));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.vendorService.updateVendor(req.params.id, req.body);
      res.json(ApiResponse.success(null, "Vendor updated"));
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.vendorService.updateVendorStatus(req.params.id, req.body.status);
      res.json(ApiResponse.success(null, "Status updated"));
    } catch (error) {
      next(error);
    }
  };

  setWorkingHours = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.vendorService.setWorkingHours(req.params.id, req.body);
      res.json(ApiResponse.success(null, "Working hours set"));
    } catch (error) {
      next(error);
    }
  };

  getWorkingHours = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const hours = await this.vendorService.getWorkingHours(req.params.id);
      res.json(ApiResponse.success(hours));
    } catch (error) {
      next(error);
    }
  };

  uploadImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ValidationError("No image file provided");
      }
      const imageUrl = `/vendors/uploads/vendors/${req.file.filename}`;
      await this.vendorService.updateStoreImage(req.params.id, imageUrl);
      res.json(ApiResponse.success({ imageUrl }, "Store image uploaded"));
    } catch (error) {
      next(error);
    }
  };
}
