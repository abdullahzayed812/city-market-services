import { Router } from "express";
import { UserRole } from "@city-market/shared";
import { authorize } from "@city-market/shared/node";
import { CommissionTierController } from "../controllers/commission-tier.controller";

export const createCommissionTierRoutes = (controller: CommissionTierController): Router => {
    const router = Router();

    // Management (Admin only)
    router.get("/", authorize(UserRole.ADMIN), controller.getAll);
    router.post("/", authorize(UserRole.ADMIN), controller.create);
    router.patch("/:id", authorize(UserRole.ADMIN), controller.update);
    router.delete("/:id", authorize(UserRole.ADMIN), controller.delete);

    return router;
};
