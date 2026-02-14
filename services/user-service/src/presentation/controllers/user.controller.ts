import { Response, NextFunction } from "express";
import { UserService } from "../../application/services/user.service";
import { ApiResponse } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { AuthRequest } from "@city-market/shared/node";

export class UserController {
  constructor(private userService: UserService) {}

  createCustomer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const dto = { ...req.body, userId: req.user!.userId };
      const customer = await this.userService.createCustomer(dto);
      Logger.info("Customer created", { customerId: customer.id });
      res.status(201).json(ApiResponse.success(customer, "Customer created"));
    } catch (error) {
      next(error);
    }
  };

  getMyProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const customer = await this.userService.getCustomerByUserId(req.user!.userId);
      res.json(ApiResponse.success(customer));
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const customer = await this.userService.getCustomerByUserId(req.user!.userId);
      await this.userService.updateCustomer(customer.id, req.body);
      res.json(ApiResponse.success(null, "Profile updated"));
    } catch (error) {
      next(error);
    }
  };

  addAddress = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const customer = await this.userService.getCustomerByUserId(req.user!.userId);
      const address = await this.userService.addAddress(customer.id, req.body);
      res.status(201).json(ApiResponse.success(address, "Address added"));
    } catch (error) {
      next(error);
    }
  };

  getMyAddresses = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      console.log(req.user!.userId);
      const customer = await this.userService.getCustomerByUserId(req.user!.userId);
      const addresses = await this.userService.getCustomerAddresses(customer.id);
      res.json(ApiResponse.success(addresses));
    } catch (error) {
      next(error);
    }
  };

  deleteAddress = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.userService.deleteAddress(req.params.addressId);
      res.json(ApiResponse.success(null, "Address deleted"));
    } catch (error) {
      next(error);
    }
  };
}
