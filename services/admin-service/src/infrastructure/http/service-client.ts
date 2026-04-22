import { AuthClient } from "./clients/AuthClient";
import { UserClient } from "./clients/UserClient";
import { VendorClient } from "./clients/VendorClient";
import { OrderClient } from "./clients/OrderClient";
import { DeliveryClient } from "./clients/DeliveryClient";
import { CatalogClient } from "./clients/CatalogClient";

export class ServiceClient {
  public auth: AuthClient;
  public user: UserClient;
  public vendor: VendorClient;
  public order: OrderClient;
  public delivery: DeliveryClient;
  public catalog: CatalogClient;

  constructor(
    orderServiceUrl: string,
    vendorServiceUrl: string,
    deliveryServiceUrl: string,
    userServiceUrl: string,
    authServiceUrl: string,
    catalogServiceUrl: string,
  ) {
    this.auth = new AuthClient(authServiceUrl);
    this.user = new UserClient(userServiceUrl);
    this.vendor = new VendorClient(vendorServiceUrl);
    this.order = new OrderClient(orderServiceUrl);
    this.delivery = new DeliveryClient(deliveryServiceUrl);
    this.catalog = new CatalogClient(catalogServiceUrl);
  }

  // Deprecated methods for backward compatibility during transition
  // They just delegate to the new specialized clients

  async getAllOrders(page?: number, limit?: number, userId?: string) {
    return this.order.getAllOrders(page, limit, userId);
  }

  async getAllUsers(page?: number, limit?: number, userId?: string, role?: string) {
    return this.auth.getAllUsers(page, limit, userId, role);
  }

  async getAllVendors(page?: number, limit?: number, userId?: string) {
    return this.vendor.getAllVendors(page, limit, userId);
  }

  async suspendVendor(vendorId: string, userId?: string) {
    return this.vendor.suspendVendor(vendorId, userId);
  }

  async getAllCouriers(page?: number, limit?: number, userId?: string) {
    return this.delivery.getAllCouriers(page, limit, userId);
  }

  async deactivateCourier(courierId: string, userId?: string) {
    return this.delivery.deactivateCourier(courierId, userId);
  }

  async getUserById(id: string, userId?: string) {
    return this.user.getUserById(id, userId);
  }

  async updateUserStatus(id: string, status: string, userId?: string) {
    return this.user.updateUserStatus(id, status, userId);
  }

  async getVendorById(id: string, userId?: string) {
    return this.vendor.getVendorById(id, userId);
  }

  async getVendorsByIds(ids: string[], userId?: string) {
    return this.vendor.getVendorsByIds(ids, userId);
  }

  async updateVendorStatus(id: string, status: string, userId?: string) {
    return this.vendor.updateVendorStatus(id, status, userId);
  }

  async uploadVendorImage(id: string, formData: any, userId?: string) {
    return this.vendor.uploadVendorImage(id, formData, userId);
  }

  async getOrderById(id: string, userId?: string) {
    return this.order.getOrderById(id, userId);
  }

  async updateOrderStatus(id: string, status: string, userId?: string) {
    return this.order.updateOrderStatus(id, status, userId);
  }

  async getDeliveries(userId?: string) {
    return this.delivery.getDeliveries(userId);
  }

  async getAvailableCouriers(userId?: string) {
    return this.delivery.getAvailableCouriers(userId);
  }

  async getAllCategories(userId?: string) {
    return this.catalog.getAllCategories(userId);
  }

  async getCategoryById(id: string, userId?: string) {
    return this.catalog.getCategoryById(id, userId);
  }

  async createCategory(data: any, userId?: string) {
    return this.catalog.createCategory(data, userId);
  }

  async updateCategory(id: string, data: any, userId?: string) {
    return this.catalog.updateCategory(id, data, userId);
  }

  async deleteCategory(id: string, userId?: string) {
    return this.catalog.deleteCategory(id, userId);
  }

  async uploadCategoryIcon(id: string, formData: any, userId?: string) {
    return this.catalog.uploadCategoryIcon(id, formData, userId);
  }

  async getAllProducts(page?: number, limit?: number, userId?: string, globalCat?: string, vendorCat?: string, vendorId?: string, search?: string) {
    return this.catalog.getAllProducts(page, limit, userId, globalCat, vendorCat, vendorId, search);
  }

  async createProduct(data: any, userId?: string) {
    return this.catalog.createProduct(data, userId);
  }

  async updateProduct(id: string, data: any, userId?: string) {
    return this.catalog.updateProduct(id, data, userId);
  }

  async deleteProduct(id: string, userId?: string) {
    return this.catalog.deleteProduct(id, userId);
  }

  async uploadProductImage(id: string, formData: any, userId?: string) {
    return this.catalog.uploadProductImage(id, formData, userId);
  }

  async getGlobalProducts(page?: number, limit?: number, userId?: string) {
    return this.catalog.getGlobalProducts(page, limit, userId);
  }

  async createGlobalProduct(data: any, userId?: string) {
    return this.catalog.createGlobalProduct(data, userId);
  }

  async updateGlobalProduct(id: string, data: any, userId?: string) {
    return this.catalog.updateGlobalProduct(id, data, userId);
  }

  async deleteGlobalProduct(id: string, userId?: string) {
    return this.catalog.deleteGlobalProduct(id, userId);
  }

  async getAllCommissionTiers(userId?: string) {
    return this.order.getCommissionTiers(userId);
  }

  async createCommissionTier(data: any, userId?: string) {
    return this.order.createCommissionTier(data, userId);
  }

  async updateCommissionTier(id: string, data: any, userId?: string) {
    return this.order.updateCommissionTier(id, data, userId);
  }

  async deleteCommissionTier(id: string, userId?: string) {
    return this.order.deleteCommissionTier(id, userId);
  }
}
