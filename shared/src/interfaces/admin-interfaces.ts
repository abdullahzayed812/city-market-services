import { UserStatus } from "../enums/user-status";

export interface DashboardStats {
  totalOrders: number;
  totalVendors: number;
  totalCouriers: number;
  totalUsers: number;
  revenueToday: number;
}

export interface UpdateUserStatusRequest {
  status: UserStatus;
}

export interface RevenueReport {
  totalRevenue: number;
  platformCommission: number;
  payouts: { id: string; vendorName: string; amount: number; status: string; date: string }[];
}

export interface PayoutsReport {
  payouts: number;
  date: Date;
}
