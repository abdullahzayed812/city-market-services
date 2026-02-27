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
  type Product,
  type CreateProductDto,
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

  // Products Management
  getProducts: async (page: number, limit: number, categoryId?: string): Promise<{ data: Product[]; hasMore: boolean }> => {
    const response = await axiosInstance.get<ApiResponse<{ data: Product[]; total: number; page: number; limit: number }>>("/admin/products", {
      params: { page, limit, categoryId },
    });
    const { data, total } = response.data.data;
    const hasMore = (page * limit) < total;
    return { data, hasMore };
  },
  createProduct: (body: CreateProductDto) => axiosInstance.post<ApiResponse<Product>>("/admin/products", body),
  updateProduct: (id: string, body: Partial<Product>) => axiosInstance.put<ApiResponse<null>>(`/admin/products/${id}`, body),
  deleteProduct: (id: string) => axiosInstance.delete<ApiResponse<null>>(`/admin/products/${id}`),
  uploadProductImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file); // Use "image" as the field name as per vendor-service upload
    return axiosInstance.post<ApiResponse<{ imageUrl: string }>>(`/admin/products/${id}/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
