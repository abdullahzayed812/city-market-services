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
  type User,
} from "@city-market/shared";

export const adminApi = {
  // Dashboard Overview
  getStats: () => axiosInstance.get<ApiResponse<DashboardStats>>("/admin/dashboard"),

  // Users Management
  getUsers: (role?: string) => axiosInstance.get<ApiResponse<{ data: User[]; total: number }>>("/admin/users", { params: { role } }),
  getUserById: (id: string) => axiosInstance.get<ApiResponse<User>>(`/admin/users/${id}`),
  updateUserStatus: (id: string, body: UpdateUserStatusRequest) => axiosInstance.patch<ApiResponse<null>>(`/admin/users/${id}/status`, body),

  // Vendors Management
  getVendors: () => axiosInstance.get<ApiResponse<Vendor[]>>("/admin/vendors"),
  getVendorById: (id: string) => axiosInstance.get<ApiResponse<Vendor>>(`/admin/vendors/${id}`),
  updateVendor: (id: string, body: Partial<Vendor>) => axiosInstance.patch<ApiResponse<null>>(`/admin/vendors/${id}`, body),

  updateVendorStatus: (
    id: string,
    body: { status: ShopStatus }, // Use inline type for update status
  ) => axiosInstance.patch<ApiResponse<null>>(`/admin/vendors/${id}/status`, body),
  updateVendorImage: (id: string, imageUrl: string) =>
    axiosInstance.patch<ApiResponse<null>>(`/admin/vendors/${id}/image`, { imageUrl }),

  // Orders Management
  getOrders: () => axiosInstance.get<ApiResponse<CustomerOrder[]>>("/admin/orders"),
  getOrderById: (id: string) => axiosInstance.get<ApiResponse<OrderWithItems>>(`/admin/orders/${id}`),
  updateOrderStatus: (
    id: string,
    body: { status: CustomerOrderStatus }, // Use inline type for update status
  ) => axiosInstance.patch<ApiResponse<null>>(`/admin/orders/${id}/status`, body),

  // Delivery Monitoring
  getDeliveries: () => axiosInstance.get<ApiResponse<Delivery[]>>("/admin/deliveries"),
  getCouriers: () => axiosInstance.get<ApiResponse<Courier[]>>("/admin/couriers"),
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
  getDeliveryOffices: () => axiosInstance.get<ApiResponse<any[]>>("/admin/delivery-offices"),

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
  ): Promise<{ data: VendorProduct[]; hasMore: boolean }> => {
    const response = await axiosInstance.get<ApiResponse<{ data: VendorProduct[]; total: number }>>("/admin/products", {
      params: { page, limit, ...filters },
    });

    const { data: itemsData, total } = response.data.data!;
    const hasMore = page * limit < total;
    return { data: itemsData, hasMore };
  },
  createVendorProduct: (body: CreateVendorProductDto) => axiosInstance.post<ApiResponse<VendorProduct>>("/admin/products", body),
  updateVendorProduct: (id: string, body: Partial<VendorProduct>) => axiosInstance.put<ApiResponse<null>>(`/admin/products/${id}`, body),
  deleteVendorProduct: (id: string) => axiosInstance.delete<ApiResponse<null>>(`/admin/products/${id}`),
  updateVendorProductImage: (id: string, imageUrl: string) =>
    axiosInstance.patch<ApiResponse<null>>(`/admin/products/${id}/image`, { imageUrl }),

  // Global Products management
  getGlobalProducts: async (page: number, limit: number, search?: string): Promise<{ data: GlobalProduct[]; total: number }> => {
    const response = await axiosInstance.get<ApiResponse<{ data: GlobalProduct[]; total: number }>>("/admin/global-products", {
      params: { page, limit, search },
    });
    return response.data.data!;
  },
  createGlobalProduct: (body: Partial<GlobalProduct>) => axiosInstance.post<ApiResponse<GlobalProduct>>("/admin/global-products", body),
  updateGlobalProduct: (id: string, body: Partial<GlobalProduct>) => axiosInstance.patch<ApiResponse<null>>(`/admin/global-products/${id}`, body),
  deleteGlobalProduct: (id: string) => axiosInstance.delete<ApiResponse<null>>(`/admin/global-products/${id}`),
};
