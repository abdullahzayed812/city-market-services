import { ServiceClient } from "../../infrastructure/http/service-client";
import { Logger } from "@city-market/shared/node";
import FormData from "form-data";

export interface DashboardStats {
  totalOrders: number;
  totalVendors: number;
  totalCouriers: number;
  totalUsers: number;
  revenueToday: number;
}

export class AdminService {
  constructor(private serviceClient: ServiceClient) { }

  async getDashboardStats(userId?: string): Promise<DashboardStats> { // Changed to userId
    Logger.info("Fetching dashboard statistics");

    const [ordersData, vendorsData, couriersData, usersData] = await Promise.all([
      this.serviceClient.getAllOrders(1, 100, userId), // Passed userId
      this.serviceClient.getAllVendors(1, 100, userId), // Passed userId
      this.serviceClient.getAllCouriers(1, 100, userId), // Passed userId
      this.serviceClient.getAllUsers(1, 100, userId), // Passed userId
    ]);

    const stats: DashboardStats = {
      totalOrders: ordersData.data?.length || 0,
      totalVendors: vendorsData.data?.length || 0,
      totalCouriers: couriersData.data?.length || 0,
      totalUsers: usersData?.data?.length || 0,
      revenueToday: (ordersData.data ?? [])
        .filter((order: any) => order.status === "DELIVERED")
        .reduce((sum: any, order: any) => sum + (order.commissionAmount || 0), 0),
    };

    return stats;
  }

  async getAllOrders(page: number = 1, limit: number = 50, userId?: string) { // Changed to userId
    return this.serviceClient.getAllOrders(page, limit, userId); // Passed userId
  }

  async getAllVendors(page: number = 1, limit: number = 50, userId?: string) { // Changed to userId
    return this.serviceClient.getAllVendors(page, limit, userId); // Passed userId
  }

  async updateVendorCommission(vendorId: string, rate: number, userId?: string) { // Changed to userId
    if (rate < 0 || rate > 100) {
      throw new Error("Commission rate must be between 0 and 100");
    }
    return this.serviceClient.updateVendorCommission(vendorId, rate, userId); // Passed userId
  }

  async suspendVendor(vendorId: string, userId?: string) { // Changed to userId
    Logger.warn(`Suspending vendor ${vendorId}`);
    return this.serviceClient.suspendVendor(vendorId, userId); // Passed userId
  }

  async getAllCouriers(page: number = 1, limit: number = 50, userId?: string) { // Changed to userId
    return this.serviceClient.getAllCouriers(page, limit, userId); // Passed userId
  }

  async deactivateCourier(courierId: string, userId?: string) { // Changed to userId
    Logger.warn(`Deactivating courier ${courierId}`);
    return this.serviceClient.deactivateCourier(courierId, userId); // Passed userId
  }

  async getAllUsers(page: number = 1, limit: number = 50, userId?: string, role?: string) { // Changed to userId
    return this.serviceClient.getAllUsers(page, limit, userId, role); // Passed userId
  }

  async getUserById(id: string, userId?: string) { // Changed to userId
    return this.serviceClient.getUserById(id, userId); // Passed userId
  }

  async updateUserStatus(id: string, status: string, userId?: string) { // Changed to userId
    return this.serviceClient.updateUserStatus(id, status, userId); // Passed userId
  }

  async getVendorById(id: string, userId?: string) { // Changed to userId
    return this.serviceClient.getVendorById(id, userId); // Passed userId
  }

  async updateVendorStatus(id: string, status: string, userId?: string) { // Changed to userId
    return this.serviceClient.updateVendorStatus(id, status, userId); // Passed userId
  }

  async uploadVendorImage(id: string, formData: FormData, userId?: string) {
    Logger.info(`Uploading image for vendor ${id}`);
    return this.serviceClient.uploadVendorImage(id, formData, userId);
  }

  async getOrderById(id: string, userId?: string) { // Changed to userId
    return this.serviceClient.getOrderById(id, userId); // Passed userId
  }

  async updateOrderStatus(id: string, status: string, userId?: string) { // Changed to userId
    return this.serviceClient.updateOrderStatus(id, status, userId); // Passed userId
  }

  async getDeliveries(userId?: string) { // Changed to userId
    return this.serviceClient.getDeliveries(userId); // Passed userId
  }

  async getAvailableCouriers(userId?: string) { // Changed to userId
    return this.serviceClient.getAvailableCouriers(userId); // Passed userId
  }

  async getRevenue(userId?: string) { // Changed to userId
    // In a real application, this would involve more complex logic
    return Promise.resolve({
      totalRevenue: 25000,
      platformCommission: 2500,
      payouts: [
        { id: "P-001", vendorName: "The Corner Store", amount: 1200, status: "completed", date: "2026-01-14" },
        { id: "P-002", vendorName: "Fresh Market", amount: 850, status: "pending", date: "2026-01-14" },
        { id: "P-003", vendorName: "Tech Haven", amount: 2100, status: "completed", date: "2026-01-13" },
      ],
    });
  }

  async getPayouts(userId?: string) { // Changed to userId
    // In a real application, this would involve more complex logic
    return Promise.resolve({ payouts: 5000, date: new Date() });
  }

  // Category Management
  async getAllCategories(userId?: string) {
    return this.serviceClient.getAllCategories(userId);
  }

  async getCategoryById(id: string, userId?: string) {
    return this.serviceClient.getCategoryById(id, userId);
  }

  async createCategory(data: any, userId?: string) {
    return this.serviceClient.createCategory(data, userId);
  }

  async updateCategory(id: string, data: any, userId?: string) {
    return this.serviceClient.updateCategory(id, data, userId);
  }

  async deleteCategory(id: string, userId?: string) {
    return this.serviceClient.deleteCategory(id, userId);
  }

  async uploadCategoryIcon(id: string, formData: any, userId?: string) {
    return this.serviceClient.uploadCategoryIcon(id, formData, userId);
  }

  // Product Management
  async getAllProducts(
    page: number = 1, 
    limit: number = 20, 
    userId?: string, 
    globalCategoryId?: string, 
    vendorCategoryId?: string
  ) {
    const productsData = await this.serviceClient.getAllProducts(page, limit, userId, globalCategoryId, vendorCategoryId);
    
    if (productsData.data?.data && productsData.data.data.length > 0) {
      const vendorIds = [...new Set(productsData.data.data.map((p: any) => p.vendorId))];
      const vendorsResponse = await this.serviceClient.getVendorsByIds(vendorIds as string[], userId);
      const vendorsMap = (vendorsResponse.data || []).reduce((acc: any, v: any) => {
        acc[v.id] = v.shopName;
        return acc;
      }, {});

      productsData.data.data = productsData.data.data.map((p: any) => ({
        ...p,
        vendorShopName: vendorsMap[p.vendorId] || "Unknown"
      }));
    }

    return productsData;
  }

  async createProduct(data: any, userId?: string) {
    return this.serviceClient.createProduct(data, userId);
  }

  async updateProduct(id: string, data: any, userId?: string) {
    return this.serviceClient.updateProduct(id, data, userId);
  }

  async deleteProduct(id: string, userId?: string) {
    return this.serviceClient.deleteProduct(id, userId);
  }

  async uploadProductImage(id: string, formData: FormData, userId?: string) {
    Logger.info(`Uploading image for product ${id}`);
    return this.serviceClient.uploadProductImage(id, formData, userId);
  }
}
