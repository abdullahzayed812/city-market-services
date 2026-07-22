import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Clock, Calendar, ChevronRight, Timer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { OrderService } from "@/services/api/orderService";
import { useAuthStore } from "@/store/authStore";
import { CustomerOrderStatus } from "@/types";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { useTranslation } from "react-i18next";
import { useSlaCountdown } from "@/hooks/useSlaCountdown";
import type { CustomerOrder } from "@/types";

const PAGE_SIZE = 20;

function OrderCard({ order }: { order: CustomerOrder }) {
  const { t } = useTranslation();
  const needsAction = order.status === CustomerOrderStatus.WAITING_CUSTOMER_DECISION;
  const countdown = useSlaCountdown(needsAction ? order.customerDecisionDeadline : null);

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    [CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION]: { label: t("orders.status_pending"), color: "#F59E0B" },
    [CustomerOrderStatus.WAITING_CUSTOMER_DECISION]: { label: t("orders.status_waiting_customer_decision"), color: "#F59E0B" },
    [CustomerOrderStatus.READY]: { label: t("orders.status_ready"), color: "#10B981" },
    [CustomerOrderStatus.IN_DELIVERY]: { label: t("orders.status_in_delivery"), color: "#10B981" },
    [CustomerOrderStatus.COMPLETED]: { label: t("orders.status_completed"), color: "#10B981" },
    [CustomerOrderStatus.CANCELLED]: { label: t("orders.status_cancelled"), color: "#EF4444" },
  };

  const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: "#9CA3AF" };
  const date = new Date(order.createdAt);

  return (
    <Link to={`/orders/${order.id}`}>
      <motion.div
        whileHover={{ y: -2 }}
        className={`bg-white rounded-2xl mb-1 shadow-card p-4 transition-shadow hover:shadow-medium ${needsAction ? "ring-2 ring-amber-400" : ""}`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary-xlight rounded-xl flex items-center justify-center">
              <Package size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary tracking-wider">#{order.id.slice(-6).toUpperCase()}</p>
              {needsAction && <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">{t("orders.status_waiting_customer_decision")}</p>}
            </div>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5"
            style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
            {cfg.label}
          </span>
        </div>

        {needsAction && countdown.remainingSeconds > 0 && !countdown.isExpired && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold mb-3 ${
              countdown.isWarning ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            <Timer size={12} />
            <span className="uppercase tracking-wide">{t("orders.decide_before", "Decide before")}:</span>
            <span className="font-mono tabular-nums">{countdown.formattedTime}</span>
          </div>
        )}

        <div className="h-px bg-border-light mb-3" />

        <div className="flex items-center gap-4 mb-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <Calendar size={12} />
            {date.toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-text-muted uppercase font-semibold tracking-wide mb-0.5">{t("orders.total_amount")}</p>
            <p className="text-lg font-black text-text-primary">{formatPrice(order.totalAmount)}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-primary bg-primary-xlight px-3.5 py-2 rounded-full">
            {needsAction ? t("orders.review") : t("orders.track")}
            <ChevronRight size={13} />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["my-orders", page],
    queryFn: () => OrderService.getMyOrders(page, PAGE_SIZE),
    enabled: isAuthenticated,
  });

  const orders = data?.items ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <h1 className="text-2xl font-black text-text-primary tracking-tight mb-6">{t("orders.title")}</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-primary-xlight rounded-full flex items-center justify-center mb-4">
            <Package size={36} className="text-primary" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">{t("orders.no_orders")}</h3>
          <p className="text-sm text-text-muted mb-6 max-w-xs">{t("orders.no_orders_hint")}</p>
          <Button onClick={() => navigate("/")}>{t("home.stores")}</Button>
        </motion.div>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} className="mt-6" />
        </>
      )}
    </div>
  );
}
