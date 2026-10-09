import { randomUUID } from "crypto";
import { ServiceClient } from "../../infrastructure/http/service-client";
import { Logger } from "@city-market/shared/node";
import type { BulkAddVendorProductsFromGlobalItem, DashboardStats } from "@city-market/shared";
import { CourierFilter } from "../../infrastructure/http/clients/DeliveryClient";
import { ValidationError } from "@city-market/shared";

// auth-service's /register requires a deviceId (it's built around a real client device
// bootstrapping a session). These admin-initiated account creations aren't tied to any
// device — there's no real client to source one from — so synthesize one per call.
const adminDeviceContext = () => ({ deviceId: randomUUID(), platform: "web" as const });

export class AdminService {
  constructor(private serviceClient: ServiceClient) { }

  async getDashboardStats(userId?: string): Promise<DashboardStats> {
    Logger.info("Fetching dashboard statistics");

    const [orderStats, vendorsCount, couriersCount, usersCount] = await Promise.all([
      this.serviceClient.order.getOrderStats(userId),
      this.serviceClient.vendor.getVendorsCount(userId),
      this.serviceClient.delivery.getCouriersCount(userId),
      this.serviceClient.auth.getUsersCount(userId),
    ]);

    return {
      totalOrders: orderStats.data?.totalOrders || 0,
      revenueToday: orderStats.data?.revenueToday || 0,
      totalVendors: vendorsCount.data?.total || 0,
      totalCouriers: couriersCount.data?.total || 0,
      totalUsers: usersCount.data?.total || 0,
    };
  }

  async getAllOrders(page: number = 1, limit: number = 50, userId?: string, filter: Record<string, string | undefined> = {}) {
    return this.serviceClient.order.getAllOrders(page, limit, userId, filter);
  }

  async getAllVendors(page: number = 1, limit: number = 50, userId?: string) {
    return this.serviceClient.vendor.getAllVendors(page, limit, userId);
  }

  async suspendVendor(vendorId: string, userId?: string) {
    Logger.warn(`Suspending vendor ${vendorId}`);
    return this.serviceClient.vendor.suspendVendor(vendorId, userId);
  }

  async getAllCouriers(page: number = 1, limit: number = 50, userId?: string, filter: CourierFilter = {}) {
    return this.serviceClient.delivery.getAllCouriers(page, limit, userId, filter);
  }

  async getCouriersCountFiltered(filter: CourierFilter, userId?: string) {
    return this.serviceClient.delivery.getCouriersCount(userId, filter);
  }

  async setCourierApproval(courierId: string, approvalStatus: string, userId?: string) {
    Logger.warn(`Setting courier ${courierId} approval to ${approvalStatus}`);
    return this.serviceClient.delivery.setCourierApproval(courierId, approvalStatus, userId);
  }

  async getAllCouriersPendingEarnings(courierType?: string, userId?: string) {
    return this.serviceClient.delivery.getAllCouriersPendingEarnings(courierType, userId);
  }

  async getCourierDetails(courierId: string, userId?: string) {
    return this.serviceClient.delivery.getCourierDetails(courierId, userId);
  }

  // Role-specific profile behind an auth user, for the admin "user details" view.
  // A missing profile (e.g. courier who never finished signup) comes back as null.
  async getUserProfile(targetUserId: string, role: string, adminUserId?: string): Promise<{ role: string; profile: any }> {
    const data = (res: any) => res?.data ?? null;
    try {
      switch (role) {
        case "COURIER":
          return { role, profile: data(await this.serviceClient.delivery.getCourierDetailsByUserId(targetUserId, adminUserId)) };
        case "CUSTOMER":
          return { role, profile: data(await this.serviceClient.user.getCustomerByUserId(targetUserId, adminUserId)) };
        case "VENDOR": {
          const vendors = data(await this.serviceClient.vendor.getAllVendors(1, 1000, adminUserId)) ?? [];
          const list = Array.isArray(vendors) ? vendors : vendors.items ?? vendors.data ?? [];
          return { role, profile: list.find((v: any) => v.userId === targetUserId) ?? null };
        }
        case "DELIVERY_MANAGER": {
          const offices = data(await this.serviceClient.delivery.getAllDeliveryOffices(adminUserId)) ?? [];
          const office = offices.find((o: any) => o.userId === targetUserId);
          // Full review (documents + stats), same shape as /admin/delivery-offices/:id/details
          return { role, profile: office ? data(await this.serviceClient.delivery.getOfficeDetails(office.id, adminUserId)) : null };
        }
        default:
          return { role, profile: null };
      }
    } catch (error: any) {
      if (error?.response?.status === 404) return { role, profile: null };
      throw error;
    }
  }

  async getDeliveryRatings(params: { courierId?: string; deliveryOfficeId?: string; page?: number; limit?: number }, userId?: string) {
    return this.serviceClient.delivery.getDeliveryRatings(params, userId);
  }

  async getVendorRatings(vendorId: string, limit?: number, offset?: number, userId?: string) {
    return this.serviceClient.rating.getVendorRatings(vendorId, limit, offset, userId);
  }

  async getDeliveryFinancialOverview(userId?: string) {
    return this.serviceClient.delivery.getDeliveryFinancialOverview(userId);
  }

  async deactivateCourier(courierId: string, userId?: string) {
    Logger.warn(`Deactivating courier ${courierId}`);
    return this.serviceClient.delivery.deactivateCourier(courierId, userId);
  }

  async getAllUsers(page: number = 1, limit: number = 50, userId?: string, role?: string, filter: Record<string, string | undefined> = {}) {
    return this.serviceClient.auth.getAllUsers(page, limit, userId, role, filter);
  }

  async getUserById(id: string, userId?: string) {
    return this.serviceClient.user.getUserById(id, userId);
  }

  async updateUserStatus(id: string, status: string, userId?: string) {
    return this.serviceClient.user.updateUserStatus(id, status, userId);
  }

  async getVendorById(id: string, userId?: string) {
    return this.serviceClient.vendor.getVendorById(id, userId);
  }

  async updateVendor(id: string, data: any, userId?: string) {
    return this.serviceClient.vendor.updateVendor(id, data, userId);
  }

  async updateVendorStatus(id: string, status: string, userId?: string) {
    return this.serviceClient.vendor.updateVendorStatus(id, status, userId);
  }

  async updateVendorImage(id: string, imageUrl: string, userId?: string) {
    return this.serviceClient.vendor.updateVendorImage(id, imageUrl, userId);
  }

  async getOrderById(id: string, userId?: string) {
    return this.serviceClient.order.getOrderById(id, userId);
  }

  async updateOrderStatus(id: string, status: string, userId?: string) {
    return this.serviceClient.order.updateOrderStatus(id, status, userId);
  }

  async getDeliveries(userId?: string) {
    return this.serviceClient.delivery.getDeliveries(userId);
  }

  async getAvailableCouriers(userId?: string) {
    return this.serviceClient.delivery.getAvailableCouriers(userId);
  }

  // async getFinancialAnalytics(vendorId: string, periodStart?: string, periodEnd?: string, userId?: string) {
  //   const ordersResult = await this.serviceClient.order.getVendorFinancials(vendorId, periodStart, periodEnd, userId);

  //   let deliveryCount = 0;
  //   const vendorOrderIds = ordersResult.data?.vendorOrderIds || [];

  //   if (vendorOrderIds.length > 0) {
  //     const deliveryResult = await this.serviceClient.delivery.getDeliveriesAnalytics(
  //       vendorOrderIds,
  //       periodStart,
  //       periodEnd,
  //       userId,
  //     );
  //     deliveryCount = deliveryResult.data?.totalDeliveries || 0;
  //   }

  //   const { totalRevenue, platformCommission, totalOrders } = ordersResult.data || {};
  //   const DELIVERY_FEE = 5; // 5 EGP
  //   const totalDeliveryFees = deliveryCount * DELIVERY_FEE;
  //   const platformCommissionAmount = platformCommission || 0;
  //   // const netRevenue = (totalRevenue || 0) - platformCommissionAmount - totalDeliveryFees;

  //   return {
  //     totalRevenue: totalRevenue || 0,
  //     totalOrders: totalOrders || 0,
  //     totalDeliveries: deliveryCount,
  //     platformCommission: platformCommissionAmount,
  //     totalDeliveryFees,
  //     // netRevenue
  //   };
  // }

  // async getRevenue(userId?: string) {
  //   return Promise.resolve({
  //     totalRevenue: 25000,
  //     platformCommission: 2500,
  //     payouts: [
  //       { id: "P-001", vendorName: "The Corner Store", amount: 1200, status: "completed", date: "2026-01-14" },
  //       { id: "P-002", vendorName: "Fresh Market", amount: 850, status: "pending", date: "2026-01-14" },
  //       { id: "P-003", vendorName: "Tech Haven", amount: 2100, status: "completed", date: "2026-01-13" },
  //     ],
  //   });
  // }

  // async getPayouts(userId?: string) {
  //   return Promise.resolve({ payouts: 5000, date: new Date() });
  // }

  // Creation Management
  async registerUser(data: any, userId?: string) {
    Logger.info("Registering new user via Admin");
    return this.serviceClient.auth.register({ ...data, ...adminDeviceContext() }, userId);
  }

  async createCourier(data: any, userId?: string) {
    Logger.info("Creating new courier via Admin");
    // 1. Register user
    const userData = {
      ...adminDeviceContext(),
      email: data.email,
      password: data.password,
      role: "COURIER",
      firstName: data.firstName,
      lastName: data.lastName,
    };
    const registerResponse = await this.serviceClient.auth.register(userData, userId);
    const newUserId = registerResponse.data.user.id;

    // 2. Register courier profile
    const courierData = {
      userId: newUserId,
      fullName: `${data.firstName} ${data.lastName}`,
      phone: data.phone,
      vehicleType: data.vehicleType,
      licensePlate: data.licensePlate,
      // OFFICE couriers need deliveryOfficeId; FREELANCE couriers must not have one
      courierType: data.courierType ?? "OFFICE",
      deliveryOfficeId: data.deliveryOfficeId || undefined,
    };
    return this.serviceClient.delivery.registerCourier(courierData, userId);
  }

  // Admin adds a delivery office: manager login + office (APPROVED, admin-vetted)
  async createDeliveryOffice(data: any, userId?: string) {
    Logger.info("Creating new delivery office via Admin");
    // Check the office fields first so a bad form doesn't leave a manager login without an office
    if (!data.name?.trim() || !data.phone?.trim() || !data.address?.trim()) {
      throw new ValidationError("office_name_phone_address_required");
    }
    const registerResponse = await this.serviceClient.auth.register(
      {
        ...adminDeviceContext(),
        email: data.email,
        password: data.password,
        role: "DELIVERY_MANAGER",
        firstName: data.managerName,
      },
      userId,
    );
    return this.serviceClient.delivery.createDeliveryOffice(
      {
        userId: registerResponse.data.user.id,
        name: data.name,
        phone: data.phone,
        address: data.address,
      },
      userId,
    );
  }

  async createVendor(data: any, userId?: string) {
    Logger.info("Creating new vendor via Admin");
    // 1. Register user
    const userData = {
      ...adminDeviceContext(),
      email: data.email,
      password: data.password,
      role: "VENDOR",
      firstName: data.firstName,
      lastName: data.lastName,
    };
    const registerResponse = await this.serviceClient.auth.register(userData, userId);
    const newUserId = registerResponse.data.user.id;

    // 2. Register vendor profile
    const vendorData = {
      userId: newUserId,
      shopName: data.shopName,
      shopDescription: data.shopDescription,
      phone: data.phone,
      address: data.address,
      type: data.type,
      latitude: data.latitude,
      longitude: data.longitude,
    };
    return this.serviceClient.vendor.createVendor(vendorData, userId);
  }

  // Category Management
  async getAllCategories(userId?: string) {
    return this.serviceClient.catalog.getAllCategories(userId);
  }

  async getCategoryById(id: string, userId?: string) {
    return this.serviceClient.catalog.getCategoryById(id, userId);
  }

  async createCategory(data: any, userId?: string) {
    return this.serviceClient.catalog.createCategory(data, userId);
  }

  async updateCategory(id: string, data: any, userId?: string) {
    return this.serviceClient.catalog.updateCategory(id, data, userId);
  }

  async deleteCategory(id: string, userId?: string) {
    return this.serviceClient.catalog.deleteCategory(id, userId);
  }

  async updateCategoryIcon(id: string, iconUrl: string, userId?: string) {
    return this.serviceClient.catalog.updateCategoryIcon(id, iconUrl, userId);
  }

  // Product Management
  async getAllProducts(
    page: number = 1,
    limit: number = 20,
    userId?: string,
    globalCategoryId?: string,
    vendorCategoryId?: string,
    vendorId?: string,
    search?: string,
  ) {
    const productsData = await this.serviceClient.catalog.getAllProducts(
      page,
      limit,
      userId,
      globalCategoryId,
      vendorCategoryId,
      vendorId,
      search,
    );

    if (productsData.data?.data && productsData.data.data.length > 0) {
      const vendorIds = [...new Set(productsData.data.data.map((p: any) => p.vendorId))];
      const vendorsResponse = await this.serviceClient.vendor.getVendorsByIds(vendorIds as string[], userId);
      const vendorsMap = (vendorsResponse.data || []).reduce((acc: any, v: any) => {
        acc[v.id] = v.shopName;
        return acc;
      }, {});

      productsData.data.data = productsData.data.data.map((p: any) => ({
        ...p,
        vendorShopName: vendorsMap[p.vendorId] || "Unknown",
      }));
    }

    return productsData;
  }

  async createProduct(data: any, userId?: string) {
    return this.serviceClient.catalog.createProduct(data, userId);
  }

  async updateProduct(id: string, data: any, userId?: string) {
    return this.serviceClient.catalog.updateProduct(id, data, userId);
  }

  async deleteProduct(id: string, userId?: string) {
    return this.serviceClient.catalog.deleteProduct(id, userId);
  }

  async bulkAddVendorProductsFromGlobal(vendorId: string, data: { items: BulkAddVendorProductsFromGlobalItem[] } | { globalCategoryId: string }, userId?: string) {
    const description = "items" in data ? `${data.items.length} items` : `category ${data.globalCategoryId}`;
    Logger.info(`Bulk adding vendor products from global catalog for vendor ${vendorId} (${description})`);
    return this.serviceClient.catalog.bulkAddVendorProductsFromGlobal(vendorId, data, userId);
  }

  async updateProductImage(id: string, imageUrl: string, userId?: string) {
    return this.serviceClient.catalog.updateProductImage(id, imageUrl, userId);
  }

  // Global Product Management
  async getGlobalProducts(page: number = 1, limit: number = 20, search?: string, userId?: string, globalCategoryId?: string) {
    Logger.info("Fetching global products");
    return this.serviceClient.catalog.getGlobalProducts(page, limit, search, userId, globalCategoryId);
  }

  async createGlobalProduct(data: any, userId?: string) {
    Logger.info("Creating global product");
    return this.serviceClient.catalog.createGlobalProduct(data, userId);
  }

  async bulkCreateGlobalProducts(data: any, userId?: string) {
    Logger.info(`Bulk importing global products (${data?.items?.length ?? 0} rows)`);
    return this.serviceClient.catalog.bulkCreateGlobalProducts(data, userId);
  }

  async updateGlobalProduct(id: string, data: any, userId?: string) {
    Logger.info(`Updating global product ${id}`);
    return this.serviceClient.catalog.updateGlobalProduct(id, data, userId);
  }

  async deleteGlobalProduct(id: string, userId?: string) {
    Logger.warn(`Deleting global product ${id}`);
    return this.serviceClient.catalog.deleteGlobalProduct(id, userId);
  }

  // Commission Tiers Management
  async getAllCommissionTiers(userId?: string) {
    return this.serviceClient.order.getCommissionTiers(userId);
  }

  async createCommissionTier(data: any, userId?: string) {
    return this.serviceClient.order.createCommissionTier(data, userId);
  }

  async updateCommissionTier(id: string, data: any, userId?: string) {
    return this.serviceClient.order.updateCommissionTier(id, data, userId);
  }

  async deleteCommissionTier(id: string, userId?: string) {
    return this.serviceClient.order.deleteCommissionTier(id, userId);
  }

  // Delivery Office Management
  async getAllDeliveryOffices(userId?: string, approvalStatus?: string) {
    return this.serviceClient.delivery.getAllDeliveryOffices(userId, approvalStatus);
  }

  async getOfficeDetails(officeId: string, userId?: string) {
    return this.serviceClient.delivery.getOfficeDetails(officeId, userId);
  }

  async setOfficeApproval(officeId: string, approvalStatus: string, userId?: string) {
    Logger.warn(`Setting delivery office ${officeId} approval to ${approvalStatus}`);
    return this.serviceClient.delivery.setOfficeApproval(officeId, approvalStatus, userId);
  }

  // Delivery Courier Settlements
  async getCourierPendingEarnings(courierId: string, userId?: string) {
    return this.serviceClient.delivery.getCourierPendingEarnings(courierId, userId);
  }

  async getCourierSettlements(courierId?: string, limit?: number, offset?: number, userId?: string) {
    return this.serviceClient.delivery.getCourierSettlements(courierId, limit, offset, userId);
  }

  async createCourierSettlement(data: any, userId?: string) {
    return this.serviceClient.delivery.createCourierSettlement(data, userId);
  }

  async markCourierSettlementPaid(id: string, userId?: string) {
    return this.serviceClient.delivery.markCourierSettlementPaid(id, userId);
  }

  // Delivery Office Settlements
  async getOfficePendingEarnings(deliveryOfficeId?: string, userId?: string) {
    return this.serviceClient.delivery.getOfficePendingEarnings(deliveryOfficeId, userId);
  }

  async getOfficeSettlements(deliveryOfficeId?: string, limit?: number, offset?: number, userId?: string) {
    return this.serviceClient.delivery.getOfficeSettlements(deliveryOfficeId, limit, offset, userId);
  }

  async createOfficeSettlement(data: any, userId?: string) {
    return this.serviceClient.delivery.createOfficeSettlement(data, userId);
  }

  async markOfficeSettlementPaid(id: string, userId?: string) {
    return this.serviceClient.delivery.markOfficeSettlementPaid(id, userId);
  }

  // Delivery Fee Tiers
  async getAllDeliveryFeeTiers(userId?: string) {
    return this.serviceClient.delivery.getAllDeliveryFeeTiers(userId);
  }

  async createDeliveryFeeTier(data: any, userId?: string) {
    return this.serviceClient.delivery.createDeliveryFeeTier(data, userId);
  }

  async updateDeliveryFeeTier(id: string, data: any, userId?: string) {
    return this.serviceClient.delivery.updateDeliveryFeeTier(id, data, userId);
  }

  async deleteDeliveryFeeTier(id: string, userId?: string) {
    return this.serviceClient.delivery.deleteDeliveryFeeTier(id, userId);
  }

  // Settlement Management
  async getVendorPendingEarnings(vendorId: string, userId?: string) {
    return this.serviceClient.order.getVendorPendingEarnings(vendorId, userId);
  }

  async getSettlements(vendorId?: string, page: number = 1, limit: number = 20, userId?: string) {
    return this.serviceClient.order.getSettlements(vendorId, page, limit, userId);
  }

  async createSettlement(data: any, userId?: string) {
    return this.serviceClient.order.createSettlement(data, userId);
  }

  async markSettlementPaid(id: string, userId?: string) {
    return this.serviceClient.order.markSettlementPaid(id, userId);
  }

  async getPlatformFinancialOverview(userId?: string) {
    return this.serviceClient.order.getPlatformFinancialOverview(userId);
  }
}
