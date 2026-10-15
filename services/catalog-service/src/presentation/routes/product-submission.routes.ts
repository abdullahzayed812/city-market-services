import { Router } from "express";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";
import { ProductSubmissionController } from "../controllers/product-submission.controller";

export const createProductSubmissionRoutes = (controller: ProductSubmissionController): Router => {
  const router = Router();

  // Merchants: their own proposals only (store and approval checked in the controller)
  const merchant = authorize(UserRole.VENDOR);
  router.post("/product-submissions/check-duplicates", merchant, controller.checkDuplicates);
  router.post("/product-submissions", merchant, controller.create);
  router.get("/product-submissions/mine", merchant, controller.listMine);
  router.get("/product-submissions/:id", merchant, controller.getMine);
  router.put("/product-submissions/:id", merchant, controller.update);
  router.post("/product-submissions/:id/cancel", merchant, controller.cancel);

  // Admin review (admin token, or admin-service with a service token + X-User-Id)
  const admin = authorize(UserRole.ADMIN);
  router.get("/admin/product-submissions", admin, controller.adminList);
  router.get("/admin/product-submissions/:id", admin, controller.adminGet);
  router.post("/admin/product-submissions/:id/approve", admin, controller.approve);
  router.post("/admin/product-submissions/:id/link", admin, controller.link);
  router.post("/admin/product-submissions/:id/reject", admin, controller.reject);
  router.post("/admin/product-submissions/:id/request-changes", admin, controller.requestChanges);

  return router;
};
