import { useQuery } from "@tanstack/react-query";
import { orderService } from "@/services/api/order.service";
import { productService } from "@/services/api/product.service";
import { useAuth } from "@/components/AuthProvider";

export const useDashboardData = () => {
  const { vendor } = useAuth();
  const vendorId = vendor?.id;

  const ordersQuery = useQuery({
    queryKey: ["vendor-orders", vendorId],
    queryFn: () => orderService.getVendorOrders(vendorId!),
    enabled: !!vendorId,
  });

  const productsQuery = useQuery({
    queryKey: ["vendor-products", vendorId],
    queryFn: () => productService.getVendorProducts(vendorId!),
    enabled: !!vendorId,
  });

  const isLoading = ordersQuery.isLoading || productsQuery.isLoading;
  const isError = ordersQuery.isError || productsQuery.isError;

  const orders = ordersQuery.data || [];
  const products = productsQuery.data?.data || [];

  // Compute summary data
  const today = new Date().toISOString().split("T")[0];
  const todayOrders = orders.filter((order: any) => order.createdAt.startsWith(today));

  const totalRevenue = orders
    .filter((order: any) => order.status !== "cancelled")
    .reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0);

  const activeProducts = products.filter((product: any) => product.isAvailable).length;

  const statusSummary = orders.reduce((acc: any, order: any) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  return {
    summary: {
      todayOrdersCount: todayOrders.length,
      totalRevenue,
      activeProductsCount: activeProducts,
      statusSummary,
    },
    recentOrders: orders.slice(0, 5),
    isLoading,
    isError,
  };
};
