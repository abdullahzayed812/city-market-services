import { ServiceClient } from "../../infrastructure/http/service-client";
import { Logger } from "@city-market/shared/node";

export interface DashboardStats {
  totalOrders: number;
  totalVendors: number;
  totalCouriers: number;
  totalUsers: number;
  revenueToday: number;
}

export class AdminService {
  constructor(private serviceClient: ServiceClient) {}

  async getDashboardStats(token?: string): Promise<DashboardStats> {
    Logger.info("Fetching dashboard statistics");

    const [ordersData, vendorsData, couriersData, usersData] = await Promise.all([
      this.serviceClient.getAllOrders(1, 100, token),
      this.serviceClient.getAllVendors(1, 100, token),
      this.serviceClient.getAllCouriers(1, 100, token),
      this.serviceClient.getAllUsers(1, 100, token),
    ]);

    const stats: DashboardStats = {
      totalOrders: ordersData.data?.length || 0,
      totalVendors: vendorsData.data?.length || 0,
      totalCouriers: couriersData.data?.length || 0,
      totalUsers: usersData?.data?.length || 0,
      revenueToday: (ordersData.data ?? [])
        .filter((order: any) => order.status === "DELIVERED")
        .reduce((sum: any, order: any) => sum + order.commissionAmount, 0),
    };

    return stats;
  }

  async getAllOrders(page: number = 1, limit: number = 50, token?: string) {
    return this.serviceClient.getAllOrders(page, limit, token);
  }

  async getAllVendors(page: number = 1, limit: number = 50, token?: string) {
    return this.serviceClient.getAllVendors(page, limit, token);
  }

  async updateVendorCommission(vendorId: string, rate: number, token?: string) {
    if (rate < 0 || rate > 100) {
      throw new Error("Commission rate must be between 0 and 100");
    }
    return this.serviceClient.updateVendorCommission(vendorId, rate, token);
  }

  async suspendVendor(vendorId: string, token?: string) {
    Logger.warn(`Suspending vendor ${vendorId}`);
    return this.serviceClient.suspendVendor(vendorId, token);
  }

  async getAllCouriers(page: number = 1, limit: number = 50, token?: string) {
    return this.serviceClient.getAllCouriers(page, limit, token);
  }

  async deactivateCourier(courierId: string, token?: string) {
    Logger.warn(`Deactivating courier ${courierId}`);
    return this.serviceClient.deactivateCourier(courierId, token);
  }

  async getAllUsers(page: number = 1, limit: number = 50, token?: string) {
    return this.serviceClient.getAllUsers(page, limit, token);
  }

  async getUserById(id: string, token?: string) {
    return this.serviceClient.getUserById(id, token);
  }

  async updateUserStatus(id: string, status: string, token?: string) {
    return this.serviceClient.updateUserStatus(id, status, token);
  }

  async getVendorById(id: string, token?: string) {
    return this.serviceClient.getVendorById(id, token);
  }

  async updateVendorStatus(id: string, status: string, token?: string) {
    return this.serviceClient.updateVendorStatus(id, status, token);
  }

  async getOrderById(id: string, token?: string) {
    return this.serviceClient.getOrderById(id, token);
  }

  async updateOrderStatus(id: string, status: string, token?: string) {
    return this.serviceClient.updateOrderStatus(id, status, token);
  }

  async getDeliveries(token?: string) {
    return this.serviceClient.getDeliveries(token);
  }

  async getAvailableCouriers(token?: string) {
    return this.serviceClient.getAvailableCouriers(token);
  }

  async getRevenue(token?: string) {
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

  async getPayouts(token?: string) {
    // In a real application, this would involve more complex logic
    return Promise.resolve({ payouts: 5000, date: new Date() });
  }
}
