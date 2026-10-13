import { Response, NextFunction } from "express";
import { VendorService, VendorActor } from "../../application/services/vendor.service";
import { ApiResponse, ValidationError, UserRole, VendorApprovalStatus, NotFoundError } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { AuthenticatedRequest } from "@city-market/shared/node";
import { Vendor } from "../../core/entities/vendor.entity";

const actorOf = (req: AuthenticatedRequest): VendorActor => ({ userId: req.user?.userId, role: req.user?.role });

// Registration documents and the review trail are private: only the store's owner, admins
// and other services (service tokens carry no user) see them.
const PRIVATE_FIELDS = ["ownerName", "ownerNationalIdUrl", "commercialRegisterUrl", "taxCardUrl", "reviewNote", "submittedAt", "reviewedAt"] as const;

const forViewer = (vendor: Vendor, req: AuthenticatedRequest): Partial<Vendor> => {
  const user = req.user;
  if (!user || user.role === UserRole.ADMIN || vendor.userId === user.userId) return vendor;
  const copy: Partial<Vendor> = { ...vendor };
  for (const field of PRIVATE_FIELDS) delete copy[field];
  return copy;
};

export class VendorController {
  constructor(private vendorService: VendorService) {}

  // Admin / service creation for an existing VENDOR user (starts APPROVED).
  // Merchants apply through POST /register instead.
  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.body.userId;
      const dto = { ...req.body, userId };
      const vendor = await this.vendorService.createVendor(dto);
      Logger.info("Vendor created", { vendorId: vendor.id });
      res.status(201).json(ApiResponse.success(vendor, "vendor_created"));
    } catch (error) {
      next(error);
    }
  };

  // Merchant self-registration; the user is always the caller
  register = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const vendor = await this.vendorService.registerVendor(req.user!.userId, req.body ?? {});
      Logger.info("Vendor registration submitted", { vendorId: vendor.id });
      res.status(201).json(ApiResponse.success(vendor, "vendor_registration_submitted"));
    } catch (error) {
      next(error);
    }
  };

  resubmit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const vendor = await this.vendorService.resubmitRegistration(req.user!.userId, req.body ?? {});
      res.json(ApiResponse.success(vendor, "vendor_registration_submitted"));
    } catch (error) {
      next(error);
    }
  };

  setApproval = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status, note } = req.body ?? {};
      // Service tokens (admin-service) forward the acting admin in X-User-Id
      const adminUserId = req.user?.userId || (req.headers["x-user-id"] as string | undefined);
      const vendor = await this.vendorService.setApproval(req.params.id, status, note, adminUserId);
      res.json(ApiResponse.success(vendor, "vendor_approval_updated"));
    } catch (error) {
      next(error);
    }
  };

  getApprovalHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const history = await this.vendorService.getApprovalHistory(req.params.id);
      res.json(ApiResponse.success(history));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const vendor = await this.vendorService.getVendorById(req.params.id);
      // Customers only ever see approved stores
      if (req.user?.role === UserRole.CUSTOMER && vendor.approvalStatus !== VendorApprovalStatus.APPROVED) {
        throw new NotFoundError("vendor_not_found");
      }
      res.json(ApiResponse.success(forViewer(vendor, req)));
    } catch (error) {
      next(error);
    }
  };

  getCount = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const total = await this.vendorService.countVendors();
      res.json(ApiResponse.success({ total }));
    } catch (error) {
      next(error);
    }
  };

  // The caller's own store, incl. its approval status and review note (the apps gate on it)
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
      const requested = req.query.approvalStatus as string | undefined;
      if (requested && !(Object.values(VendorApprovalStatus) as string[]).includes(requested)) {
        throw new ValidationError("invalid_approval_status");
      }
      const role = req.user?.role;
      // Only admins (and services) list stores that aren't approved
      const approvalStatus = role && role !== UserRole.ADMIN ? VendorApprovalStatus.APPROVED : (requested as VendorApprovalStatus | undefined);
      const vendors = await this.vendorService.getAllVendors(page, limit, approvalStatus);
      res.json(ApiResponse.success(vendors.map((v) => forViewer(v, req))));
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
      res.json(ApiResponse.success(vendors.map((v) => forViewer(v, req))));
    } catch (error) {
      next(error);
    }
  };

  getOpen = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const vendors = await this.vendorService.getOpenVendors();
      res.json(ApiResponse.success(vendors.map((v) => forViewer(v, req))));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.vendorService.updateVendor(req.params.id, req.body, actorOf(req));
      res.json(ApiResponse.success(null, "vendor_updated"));
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.vendorService.updateVendorStatus(req.params.id, req.body.status, actorOf(req));
      res.json(ApiResponse.success(null, "status_updated"));
    } catch (error) {
      next(error);
    }
  };

  setWorkingHours = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.vendorService.setWorkingHours(req.params.id, req.body, actorOf(req));
      res.json(ApiResponse.success(null, "working_hours_set"));
    } catch (error) {
      next(error);
    }
  };

  getWorkingHours = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Same ownership rule as editing them
      await this.vendorService.getManageableVendor(req.params.id, actorOf(req));
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
      await this.vendorService.updateStoreImage(req.params.id, imageUrl, actorOf(req));
      res.json(ApiResponse.success({ imageUrl }, "store_image_updated"));
    } catch (error) {
      next(error);
    }
  };
}
