import axiosInstance from "./axios-instance";
import {
  ApiResponse,
  type CustomerOrder,
  type Customer,
  type Vendor,
  type Courier,
  type Delivery,
  CustomerOrderStatus,
  ShopStatus,
  type DashboardStats,
  type OrderWithItems,
  type UpdateUserStatusRequest,
  type RevenueReport,
  type PayoutsReport,
  UserStatus,
  type UpdateVendorDto, // Re-adding UpdateVendorDto as it's used by admin-service suspend/update
  type UpdateProductDto, // Re-adding UpdateProductDto as it's used by admin-service stock update (implicitly)
} from "@city-market/shared";

export const adminApi = {
  // Dashboard Overview
  getStats: () => axiosInstance.get<ApiResponse<DashboardStats>>("/admin/dashboard"),

  // Users Management
  getUsers: (role?: string) => axiosInstance.get<ApiResponse<Customer[]>>("/admin/users", { params: { role } }),
  getUserById: (id: string) => axiosInstance.get<ApiResponse<Customer>>(`/admin/users/${id}`),
  updateUserStatus: (id: string, body: UpdateUserStatusRequest) =>
    axiosInstance.patch<ApiResponse<null>>(`/admin/users/${id}/status`, body),

  // Vendors Management
  getVendors: () => axiosInstance.get<ApiResponse<Vendor[]>>("/admin/vendors"),
  getVendorById: (id: string) => axiosInstance.get<ApiResponse<Vendor>>(`/admin/vendors/${id}`),
  updateVendorStatus: (
    id: string,
    body: { status: ShopStatus } // Use inline type for update status
  ) => axiosInstance.patch<ApiResponse<null>>(`/admin/vendors/${id}/status`, body),

  // Orders Management
  getOrders: () => axiosInstance.get<ApiResponse<CustomerOrder[]>>("/admin/orders"),
  getOrderById: (id: string) => axiosInstance.get<ApiResponse<OrderWithItems>>(`/admin/orders/${id}`),
  updateOrderStatus: (
    id: string,
    body: { status: CustomerOrderStatus } // Use inline type for update status
  ) => axiosInstance.patch<ApiResponse<null>>(`/admin/orders/${id}/status`, body),

  // Delivery Monitoring
  getDeliveries: () => axiosInstance.get<ApiResponse<Delivery[]>>("/admin/deliveries"),
  getCouriers: () => axiosInstance.get<ApiResponse<Courier[]>>("/admin/couriers"),

  // Financial Overview
  getRevenue: () => axiosInstance.get<ApiResponse<RevenueReport>>("/admin/revenue"),
  getPayouts: () => axiosInstance.get<ApiResponse<PayoutsReport>>("/admin/payouts"),
};
