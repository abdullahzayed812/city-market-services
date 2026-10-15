import { Response, NextFunction } from "express";
import { ApiResponse, ForbiddenError } from "@city-market/shared";
import { AuthenticatedRequest } from "@city-market/shared/node";
import { DuplicateConflictError, ProductSubmissionService, ReviewerActor, VendorActor } from "../../application/services/product-submission.service";
import { resolveWritableVendorId } from "../middlewares/vendor-access";

type Handler = (req: AuthenticatedRequest, res: Response) => Promise<void>;

// Possible-duplicate conflicts carry the matches so the app can show them
const handle =
  (fn: Handler) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof DuplicateConflictError) {
        res.status(409).json(ApiResponse.error(error.message, { matches: error.matches }));
        return;
      }
      next(error);
    }
  };

// An approved, active merchant acting on their own store. Admins and service tokens don't
// make proposals (they create catalog products directly).
async function vendorActor(req: AuthenticatedRequest): Promise<VendorActor> {
  const vendorId = await resolveWritableVendorId(req);
  if (!vendorId || !req.user) throw new ForbiddenError("vendor_only");
  return { vendorId, userId: req.user.userId };
}

// The admin making a decision: from the token, or forwarded by admin-service (service token)
function reviewerActor(req: AuthenticatedRequest): ReviewerActor {
  if (req.authType === "service") {
    const forwarded = req.headers["x-user-id"];
    return { userId: typeof forwarded === "string" && forwarded ? forwarded : undefined, role: "ADMIN" };
  }
  return { userId: req.user?.userId, role: req.user?.role ?? "ADMIN" };
}

export class ProductSubmissionController {
  constructor(private readonly service: ProductSubmissionService) {}

  // ── Merchant ──
  checkDuplicates = handle(async (req, res) => {
    await vendorActor(req);
    res.json(ApiResponse.success({ matches: await this.service.checkDuplicates(req.body) }));
  });

  create = handle(async (req, res) => {
    const actor = await vendorActor(req);
    res.status(201).json(ApiResponse.success(await this.service.create(actor, req.body), "submission_created"));
  });

  listMine = handle(async (req, res) => {
    const actor = await vendorActor(req);
    res.json(ApiResponse.success(await this.service.listForVendor(actor, req.query)));
  });

  getMine = handle(async (req, res) => {
    const actor = await vendorActor(req);
    res.json(ApiResponse.success(await this.service.getForVendor(actor, req.params.id)));
  });

  update = handle(async (req, res) => {
    const actor = await vendorActor(req);
    res.json(ApiResponse.success(await this.service.update(actor, req.params.id, req.body), "submission_updated"));
  });

  cancel = handle(async (req, res) => {
    const actor = await vendorActor(req);
    res.json(ApiResponse.success(await this.service.cancel(actor, req.params.id), "submission_cancelled"));
  });

  // ── Admin ──
  adminList = handle(async (req, res) => {
    res.json(ApiResponse.success(await this.service.listForAdmin(req.query)));
  });

  adminGet = handle(async (req, res) => {
    res.json(ApiResponse.success(await this.service.getForAdmin(req.params.id)));
  });

  approve = handle(async (req, res) => {
    res.json(ApiResponse.success(await this.service.approve(reviewerActor(req), req.params.id, req.body), "submission_approved"));
  });

  link = handle(async (req, res) => {
    res.json(ApiResponse.success(await this.service.linkExisting(reviewerActor(req), req.params.id, req.body), "submission_approved"));
  });

  reject = handle(async (req, res) => {
    res.json(ApiResponse.success(await this.service.reject(reviewerActor(req), req.params.id, req.body), "submission_rejected"));
  });

  requestChanges = handle(async (req, res) => {
    res.json(ApiResponse.success(await this.service.requestChanges(reviewerActor(req), req.params.id, req.body), "submission_changes_requested"));
  });
}
