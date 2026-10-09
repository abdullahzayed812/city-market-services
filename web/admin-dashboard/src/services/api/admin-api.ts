import axiosInstance from "./axios-instance";
import {
  ApiResponse,
  type CustomerOrder,
  type Vendor,
  type Courier,
  type Delivery,
  CustomerOrderStatus,
  ShopStatus,
  type DashboardStats,
  type OrderWithItems,
  type UpdateUserStatusRequest,
  // type RevenueReport,
  // type PayoutsReport,
  type Category,
  type CreateCategoryDto,
  type VendorProduct,
  type CreateVendorProductDto,
  type GlobalProduct,
  type BulkAddVendorProductsFromGlobalResult,
  type User,
  MeasurementType,
  WeightUnit,
} from "@city-market/shared";

export interface BulkGlobalProductImportItem {
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface BulkGlobalProductImportRowResult {
  index: number;
  name: string;
  status: "ok" | "image_failed" | "error";
  globalProductId?: string;
  error?: string;
}

export interface BulkGlobalProductImportResult {
  created: number;
  failed: number;
  results: BulkGlobalProductImportRowResult[];
}

export const adminApi = {
  // Dashboard Overview
  getStats: () => axiosInstance.get<ApiResponse<DashboardStats>>("/admin/dashboard"),

  // Users Management
  getUsers: (params?: { role?: string; search?: string; status?: string; page?: number; limit?: number }) =>
    axiosInstance.get<ApiResponse<{ data: User[]; total: number }>>("/admin/users", { params }),
  getUserById: (id: string) => axiosInstance.get<ApiResponse<User>>(`/admin/users/${id}`),
  updateUserStatus: (id: string, body: UpdateUserStatusRequest) => axiosInstance.patch<ApiResponse<null>>(`/admin/users/${id}/status`, body),

  // Vendors Management
  // Vendors are few: load them all and filter/page in the browser
  getVendors: () => axiosInstance.get<ApiResponse<Vendor[]>>("/admin/vendors", { params: { limit: 1000 } }),
  getVendorById: (id: string) => axiosInstance.get<ApiResponse<Vendor>>(`/admin/vendors/${id}`),
  updateVendor: (id: string, body: Partial<Vendor>) => axiosInstance.patch<ApiResponse<null>>(`/admin/vendors/${id}`, body),

  updateVendorStatus: (
    id: string,
    body: { status: ShopStatus }, // Use inline type for update status
  ) => axiosInstance.patch<ApiResponse<null>>(`/admin/vendors/${id}/status`, body),
  updateVendorImage: (id: string, imageUrl: string) =>
    axiosInstance.patch<ApiResponse<null>>(`/admin/vendors/${id}/image`, { imageUrl }),

  // Orders Management
  getOrders: (params?: { status?: string; search?: string; from?: string; to?: string; page?: number; limit?: number }) =>
    axiosInstance.get<ApiResponse<{ items: (CustomerOrder & { customerName?: string })[]; total: number; page: number; limit: number }>>("/admin/orders", { params }),
  getOrderById: (id: string) => axiosInstance.get<ApiResponse<OrderWithItems>>(`/admin/orders/${id}`),
  updateOrderStatus: (
    id: string,
    body: { status: CustomerOrderStatus }, // Use inline type for update status
  ) => axiosInstance.patch<ApiResponse<null>>(`/admin/orders/${id}/status`, body),

  // Delivery Monitoring
  getDeliveries: () => axiosInstance.get<ApiResponse<Delivery[]>>("/admin/deliveries"),
  getCouriers: (params?: CourierListParams) => axiosInstance.get<ApiResponse<Courier[]>>("/admin/couriers", { params: { limit: 100, ...params } }),
  getCouriersCount: (params?: CourierListParams) => axiosInstance.get<ApiResponse<{ total: number }>>("/admin/couriers/count", { params }),
  setCourierApproval: (id: string, approvalStatus: "APPROVED" | "SUSPENDED" | "REJECTED") =>
    axiosInstance.patch<ApiResponse<null>>(`/admin/couriers/${id}/approval`, { approvalStatus }),
  getAllCouriersPendingEarnings: (courierType?: "OFFICE" | "FREELANCE") =>
    axiosInstance.get<ApiResponse<any[]>>("/admin/delivery-settlements/courier/all-pending", { params: courierType ? { courierType } : {} }),
  getDeliveryFinancialOverview: () => axiosInstance.get<ApiResponse<any>>("/admin/delivery-settlements/overview"),
  // User / courier review
  getUserProfile: (userId: string, role: string) =>
    axiosInstance.get<ApiResponse<{ role: string; profile: any }>>(`/admin/users/${userId}/profile`, { params: { role } }),
  getCourierDetails: (courierId: string) => axiosInstance.get<ApiResponse<CourierDetails>>(`/admin/couriers/${courierId}/details`),
  // Ratings
  getDeliveryRatings: (params?: { courierId?: string; deliveryOfficeId?: string; page?: number; limit?: number }) =>
    axiosInstance.get<ApiResponse<DeliveryRatingsResult>>("/admin/delivery-ratings", { params }),
  getVendorRatings: (vendorId: string, params?: { limit?: number; offset?: number }) =>
    axiosInstance.get<ApiResponse<VendorReview[]>>(`/admin/vendors/${vendorId}/ratings`, { params }),
  deactivateCourier: (id: string) => axiosInstance.patch<ApiResponse<null>>(`/admin/couriers/${id}/deactivate`, {}),

  // Financial Overview
  // getRevenue: () => axiosInstance.get<ApiResponse<RevenueReport>>("/admin/revenue"),
  // getPayouts: () => axiosInstance.get<ApiResponse<PayoutsReport>>("/admin/payouts"),

  // getFinancialAnalytics: (vendorId: string, params?: { periodStart?: string; periodEnd?: string }) =>
  //   axiosInstance.get<ApiResponse<any>>(`/admin/vendors/${vendorId}/financial-analytics`, { params }),

  // Settlements
  getVendorPendingEarnings: (vendorId: string) => axiosInstance.get<ApiResponse<any>>(`/admin/settlements/vendor/${vendorId}/pending`),
  getSettlements: (params?: { vendorId?: string; page?: number; limit?: number }) => axiosInstance.get<ApiResponse<any>>(`/admin/settlements`, { params }),
  createSettlement: (data: { vendorId: string; periodStart: string; periodEnd: string; notes?: string }) =>
    axiosInstance.post<ApiResponse<any>>("/admin/settlements", data),
  markSettlementPaid: (id: string) => axiosInstance.patch<ApiResponse<null>>(`/admin/settlements/${id}/mark-paid`, {}),
  getPlatformFinancialOverview: () => axiosInstance.get<ApiResponse<any>>("/admin/settlements/overview"),

  // Delivery Offices
  getDeliveryOffices: (approvalStatus?: string) =>
    axiosInstance.get<ApiResponse<any[]>>("/admin/delivery-offices", { params: approvalStatus ? { approvalStatus } : {} }),
  createDeliveryOffice: (data: { managerName: string; email: string; password: string; name: string; phone: string; address: string }) =>
    axiosInstance.post<ApiResponse<any>>("/admin/delivery-offices", data),
  getOfficeDetails: (officeId: string) => axiosInstance.get<ApiResponse<OfficeDetails>>(`/admin/delivery-offices/${officeId}/details`),
  setOfficeApproval: (officeId: string, approvalStatus: "APPROVED" | "SUSPENDED") =>
    axiosInstance.patch<ApiResponse<null>>(`/admin/delivery-offices/${officeId}/approval`, { approvalStatus }),

  // Courier Settlements (Delivery)
  getCourierPendingEarnings: (courierId: string) =>
    axiosInstance.get<ApiResponse<any>>(`/admin/delivery-settlements/courier/${courierId}/pending`),
  getCourierSettlements: (params?: { courierId?: string; limit?: number; offset?: number }) =>
    axiosInstance.get<ApiResponse<any[]>>("/admin/delivery-settlements/courier", { params }),
  createCourierSettlement: (data: { courierId: string; periodStart: string; periodEnd: string; notes?: string }) =>
    axiosInstance.post<ApiResponse<any>>("/admin/delivery-settlements/courier", data),
  markCourierSettlementPaid: (id: string) =>
    axiosInstance.patch<ApiResponse<null>>(`/admin/delivery-settlements/courier/${id}/mark-paid`, {}),

  // Office Settlements (Delivery)
  getOfficePendingEarnings: (deliveryOfficeId?: string) =>
    axiosInstance.get<ApiResponse<any>>("/admin/delivery-settlements/office/pending", {
      params: deliveryOfficeId ? { deliveryOfficeId } : undefined,
    }),
  getOfficeSettlements: (params?: { deliveryOfficeId?: string; limit?: number; offset?: number }) =>
    axiosInstance.get<ApiResponse<any[]>>("/admin/delivery-settlements/office", { params }),
  createOfficeSettlement: (data: { deliveryOfficeId?: string; periodStart: string; periodEnd: string; notes?: string }) =>
    axiosInstance.post<ApiResponse<any>>("/admin/delivery-settlements/office", data),
  markOfficeSettlementPaid: (id: string) =>
    axiosInstance.patch<ApiResponse<null>>(`/admin/delivery-settlements/office/${id}/mark-paid`, {}),

  // Commission Tiers
  getAllCommissionTiers: () => axiosInstance.get<ApiResponse<any>>("/admin/commission-tiers"),
  createCommissionTier: (data: any) => axiosInstance.post<ApiResponse<any>>("/admin/commission-tiers", data),
  updateCommissionTier: (id: string, data: any) => axiosInstance.patch<ApiResponse<null>>(`/admin/commission-tiers/${id}`, data),
  deleteCommissionTier: (id: string) => axiosInstance.delete<ApiResponse<null>>(`/admin/commission-tiers/${id}`),

  // Delivery Fee Tiers
  getAllDeliveryFeeTiers: () => axiosInstance.get<ApiResponse<any[]>>("/admin/delivery-fee-tiers"),
  createDeliveryFeeTier: (data: any) => axiosInstance.post<ApiResponse<any>>("/admin/delivery-fee-tiers", data),
  updateDeliveryFeeTier: (id: string, data: any) => axiosInstance.patch<ApiResponse<null>>(`/admin/delivery-fee-tiers/${id}`, data),
  deleteDeliveryFeeTier: (id: string) => axiosInstance.delete<ApiResponse<null>>(`/admin/delivery-fee-tiers/${id}`),

  // Registration Management
  registerUser: (data: any) => axiosInstance.post<ApiResponse<any>>("/admin/users/register", data),
  registerCourier: (data: any) => axiosInstance.post<ApiResponse<any>>("/admin/couriers/register", data),
  registerVendor: (data: any) => axiosInstance.post<ApiResponse<any>>("/admin/vendors/register", data),

  // Categories Management
  getCategories: () => axiosInstance.get<ApiResponse<Category[]>>("/admin/categories"),
  createCategory: (body: CreateCategoryDto) => axiosInstance.post<ApiResponse<Category>>("/admin/categories", body),
  updateCategory: (id: string, body: Partial<Category>) => axiosInstance.patch<ApiResponse<null>>(`/admin/categories/${id}`, body),
  deleteCategory: (id: string) => axiosInstance.delete<ApiResponse<null>>(`/admin/categories/${id}`),
  updateCategoryIcon: (id: string, iconUrl: string) =>
    axiosInstance.patch<ApiResponse<null>>(`/admin/categories/${id}/icon`, { iconUrl }),

  // Vendor Products Management
  getVendorProducts: async (
    page: number,
    limit: number,
    filters?: { globalCategoryId?: string; vendorCategoryId?: string; vendorId?: string; search?: string },
  ): Promise<{ data: VendorProduct[]; total: number }> => {
    const response = await axiosInstance.get<ApiResponse<{ data: VendorProduct[]; total: number }>>("/admin/products", {
      params: { page, limit, ...filters },
    });

    return response.data.data!;
  },
  createVendorProduct: (body: CreateVendorProductDto) => axiosInstance.post<ApiResponse<VendorProduct>>("/admin/products", body),
  updateVendorProduct: (id: string, body: Partial<VendorProduct>) => axiosInstance.put<ApiResponse<null>>(`/admin/products/${id}`, body),
  deleteVendorProduct: (id: string) => axiosInstance.delete<ApiResponse<null>>(`/admin/products/${id}`),
  updateVendorProductImage: (id: string, imageUrl: string) =>
    axiosInstance.patch<ApiResponse<null>>(`/admin/products/${id}/image`, { imageUrl }),
  bulkAddVendorProductsFromGlobal: async (
    vendorId: string,
    globalProductIds: string[],
    vendorCategoryId?: string,
  ): Promise<BulkAddVendorProductsFromGlobalResult> => {
    const response = await axiosInstance.post<ApiResponse<BulkAddVendorProductsFromGlobalResult>>(`/admin/vendors/${vendorId}/products/bulk-add-global`, {
      items: globalProductIds.map((globalProductId) => ({ globalProductId })),
      vendorCategoryId,
    });
    return response.data.data!;
  },
  bulkAddVendorProductsFromCategory: async (
    vendorId: string,
    globalCategoryId: string,
    vendorCategoryId?: string,
  ): Promise<BulkAddVendorProductsFromGlobalResult> => {
    const response = await axiosInstance.post<ApiResponse<BulkAddVendorProductsFromGlobalResult>>(`/admin/vendors/${vendorId}/products/bulk-add-global`, {
      globalCategoryId,
      vendorCategoryId,
    });
    return response.data.data!;
  },

  // Global Products management
  getGlobalProducts: async (page: number, limit: number, search?: string, globalCategoryId?: string): Promise<{ data: GlobalProduct[]; total: number }> => {
    const response = await axiosInstance.get<ApiResponse<{ data: GlobalProduct[]; total: number }>>("/admin/global-products", {
      params: { page, limit, search, globalCategoryId },
    });
    return response.data.data!;
  },
  createGlobalProduct: (body: Partial<GlobalProduct>) => axiosInstance.post<ApiResponse<GlobalProduct>>("/admin/global-products", body),
  bulkCreateGlobalProducts: async (body: {
    items: BulkGlobalProductImportItem[];
    globalCategoryId: string;
    measurementType: MeasurementType;
    weightUnit?: WeightUnit;
  }): Promise<BulkGlobalProductImportResult> => {
    const response = await axiosInstance.post<ApiResponse<BulkGlobalProductImportResult>>("/admin/global-products/bulk", body, {
      timeout: 130_000,
    });
    return response.data.data!;
  },
  updateGlobalProduct: (id: string, body: Partial<GlobalProduct>) => axiosInstance.patch<ApiResponse<null>>(`/admin/global-products/${id}`, body),
  deleteGlobalProduct: (id: string) => axiosInstance.delete<ApiResponse<null>>(`/admin/global-products/${id}`),
};

export interface DeliveryRatingItem {
  id: string;
  deliveryId: string;
  customerOrderId: string;
  courierId: string;
  courierName: string | null;
  deliveryOfficeId: string | null;
  officeName: string | null;
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface DeliveryRatingsResult {
  summary: { averageRating: number | null; totalRatings: number; distribution: Record<string, number> };
  items: DeliveryRatingItem[];
  hasNextPage: boolean;
}

export interface VendorReview {
  id: string;
  orderId: string;
  customerName?: string;
  stars: number;
  comment?: string;
  createdAt: string;
}

export interface CourierDetails {
  courier: Courier & { ratingCount?: number; cancellationCount?: number; lastSeenAt?: string | null };
  office: { id: string; name: string; phone: string | null } | null;
  stats: { active: number; delivered: number; failed: number; cancellations: number; unsettledCash: number };
}

export interface OfficeDetails {
  office: {
    id: string;
    userId: string;
    name: string;
    phone?: string;
    address?: string;
    isActive: boolean;
    approvalStatus: "PENDING_REVIEW" | "APPROVED" | "SUSPENDED";
    ownerNationalIdUrl?: string | null;
    commercialRegisterUrl?: string | null;
    rating: number | null;
    ratingCount: number;
    createdAt: string;
  };
  stats: { couriers: number; activeCouriers: number; activeDeliveries: number; delivered: number; failed: number };
}

export interface CourierListParams {
  courierType?: "OFFICE" | "FREELANCE";
  approvalStatus?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}
