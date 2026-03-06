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
  type Category,
  type CreateCategoryDto,
  type VendorProduct,
  type CreateVendorProductDto,
  type GlobalProduct,
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
  uploadVendorImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file); // Use "image" as the field name
    return axiosInstance.post<ApiResponse<{ imageUrl: string }>>(`/admin/vendors/${id}/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

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

  // Categories Management
  getCategories: () => axiosInstance.get<ApiResponse<Category[]>>("/admin/categories"),
  createCategory: (body: CreateCategoryDto) => axiosInstance.post<ApiResponse<Category>>("/admin/categories", body),
  updateCategory: (id: string, body: Partial<Category>) => axiosInstance.patch<ApiResponse<null>>(`/admin/categories/${id}`, body),
  deleteCategory: (id: string) => axiosInstance.delete<ApiResponse<null>>(`/admin/categories/${id}`),
  uploadCategoryIcon: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("icon", file);
    return axiosInstance.post<ApiResponse<{ iconUrl: string }>>(`/admin/categories/${id}/icon`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // Vendor Products Management
  getVendorProducts: async (
    page: number,
    limit: number,
    filters?: { globalCategoryId?: string; vendorCategoryId?: string; vendorId?: string }
  ): Promise<{ data: VendorProduct[]; hasMore: boolean }> => {
    const response = await axiosInstance.get<ApiResponse<{ data: VendorProduct[]; total: number; page: number; limit: number }>>("/admin/products", {
      params: { page, limit, ...filters },
    });
    const { data, total } = response.data.data!;
    const hasMore = (page * limit) < total;
    return { data, hasMore };
  },
  createVendorProduct: (body: CreateVendorProductDto) => axiosInstance.post<ApiResponse<VendorProduct>>("/admin/products", body),
  updateVendorProduct: (id: string, body: Partial<VendorProduct>) => axiosInstance.put<ApiResponse<null>>(`/admin/products/${id}`, body),
  deleteVendorProduct: (id: string) => axiosInstance.delete<ApiResponse<null>>(`/admin/products/${id}`),
  uploadVendorProductImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file); // Use "image" as the field name as per vendor-service upload
    return axiosInstance.post<ApiResponse<{ imageUrl: string }>>(`/admin/products/${id}/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // Global Products management
  getGlobalProducts: async (
    page: number,
    limit: number
  ): Promise<{ data: GlobalProduct[]; total: number }> => {
    const response = await axiosInstance.get<ApiResponse<{ data: GlobalProduct[]; total: number }>>("/admin/global-products", {
      params: { page, limit },
    });
    return response.data.data!;
  },
  createGlobalProduct: (body: Partial<GlobalProduct>) => axiosInstance.post<ApiResponse<GlobalProduct>>("/admin/global-products", body),
  updateGlobalProduct: (id: string, body: Partial<GlobalProduct>) => axiosInstance.patch<ApiResponse<null>>(`/admin/global-products/${id}`, body),
  deleteGlobalProduct: (id: string) => axiosInstance.delete<ApiResponse<null>>(`/admin/global-products/${id}`),
};
