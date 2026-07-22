import { Response, NextFunction } from "express";
import { UserService } from "../../application/services/user.service";
import { ApiResponse } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { AuthenticatedRequest } from "@city-market/shared/node";

export class UserController {
  constructor(private userService: UserService) {}

  createCustomer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dto = { ...req.body, userId: req.user!.userId };
      const customer = await this.userService.createCustomer(dto);
      Logger.info("Customer created", { customerId: customer.id });
      res.status(201).json(ApiResponse.success(customer, "customer_created"));
    } catch (error) {
      next(error);
    }
  };

  getMyProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const customer = await this.userService.getCustomerByUserId(req.user!.userId);
      res.json(ApiResponse.success(customer));
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const customer = await this.userService.getCustomerByUserId(req.user!.userId);
      await this.userService.updateCustomer(customer.id, req.body);
      res.json(ApiResponse.success(null, "profile_updated"));
    } catch (error) {
      next(error);
    }
  };

  addAddress = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const customer = await this.userService.getCustomerByUserId(req.user!.userId);
      const address = await this.userService.addAddress(customer.id, req.body);
      res.status(201).json(ApiResponse.success(address, "address_added"));
    } catch (error) {
      next(error);
    }
  };

  getMyAddresses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // console.log(req.user!.userId);
      const customer = await this.userService.getCustomerByUserId(req.user!.userId);
      const addresses = await this.userService.getCustomerAddresses(customer.id);
      res.json(ApiResponse.success(addresses));
    } catch (error) {
      next(error);
    }
  };

  deleteAddress = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.userService.deleteAddress(req.params.addressId);
      res.json(ApiResponse.success(null, "address_deleted"));
    } catch (error) {
      next(error);
    }
  };

  getCustomerByUserId = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const customer = await this.userService.getCustomerByUserId(req.params.userId);
      res.json(ApiResponse.success(customer));
    } catch (error) {
      next(error);
    }
  };

  getCustomersByIds = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ids = req.query.ids ? (req.query.ids as string).split(",") : [];
      const customers = await this.userService.getCustomersByIds(ids);
      res.json(ApiResponse.success(customers));
    } catch (error) {
      next(error);
    }
  };

  registerDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress;
      await this.userService.registerDeviceInfo(req.user!.userId, req.body, ip);
      res.json(ApiResponse.success(null, "device_registered"));
    } catch (error) {
      next(error);
    }
  };
}
