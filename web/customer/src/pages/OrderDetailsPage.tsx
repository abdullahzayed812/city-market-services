import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Package, MapPin, Receipt, Clock, AlertCircle, Star, XCircle, Ban, CheckCircle, Truck, ShoppingBag, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OrderService } from "@/services/api/orderService";
import { RatingService } from "@/services/api/ratingService";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { CustomerOrderStatus, VendorOrderStatus } from "@/types";
import { formatPrice, formatDateTime } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/useLanguage";
import toast from "react-hot-toast";
import type { VendorOrder } from "@/types";

const STATUS_STEP_MAP: Record<string, number> = {
  [CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION]: 0,
  [CustomerOrderStatus.WAITING_CUSTOMER_DECISION]: 1,
  [CustomerOrderStatus.READY]: 2,
  [CustomerOrderStatus.IN_DELIVERY]: 3,
  [CustomerOrderStatus.COMPLETED]: 4,
  [CustomerOrderStatus.CANCELLED]: -1,
};

function useVendorStatusConfig() {
  const { t } = useTranslation();
  return {
    [VendorOrderStatus.PENDING_CONFIRMATION]: { label: t('orders.vendor_status_pending'), variant: "warning" as const },
    [VendorOrderStatus.CONFIRMED]: { label: t('orders.vendor_status_confirmed'), variant: "info" as const },
    [VendorOrderStatus.PREPARING]: { label: t('orders.vendor_status_preparing'), variant: "info" as const },
    [VendorOrderStatus.READY]: { label: t('orders.vendor_status_ready'), variant: "success" as const },
    [VendorOrderStatus.PICKED_UP]: { label: t('orders.vendor_status_picked_up'), variant: "success" as const },
    [VendorOrderStatus.DELIVERED]: { label: t('orders.vendor_status_delivered'), variant: "success" as const },
    [VendorOrderStatus.CANCELLED]: { label: t('orders.vendor_status_cancelled'), variant: "error" as const },
  };
}

function RatingModal({ open, onClose, vendor, orderId }: { open: boolean; onClose: () => void; vendor: { id: string; name: string } | null; orderId: string }) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: () => RatingService.rateVendor(orderId, vendor!.id, stars, comment || undefined),
    onSuccess: () => {
      toast.success(t('rating.thank_you_generic'));
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      onClose();
    },
    onError: () => toast.error(t('rating.submit_failed')),
  });

  return (
    <Modal open={open} onClose={onClose} title={`${t('rating.rate_vendor_title')} ${vendor?.name}`}>
      <div className="text-center">
        <p className="text-sm text-text-muted mb-4">{t('rating.rate_experience')}</p>
        <div className="flex justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setStars(n)}>
              <Star size={32} className={`transition-colors ${n <= stars ? "fill-accent text-accent" : "text-gray-300"}`} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('rating.comment_placeholder')}
          className="w-full h-24 px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <div className="flex gap-3 mt-4">
          <Button variant="ghost" fullWidth onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button fullWidth loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t('orders.submit_review')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function OrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [ratingVendor, setRatingVendor] = useState<{ id: string; name: string } | null>(null);
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const VENDOR_STATUS_CONFIG = useVendorStatusConfig();

  const ORDER_STEPS = [
    { key: "placed", label: t('orders.status_pending'), icon: ShoppingBag },
    { key: "confirmed", label: t('orders.status_confirmed'), icon: CheckCircle },
    { key: "preparing", label: t('orders.status_preparing'), icon: Package },
    { key: "delivery", label: t('orders.status_in_delivery'), icon: Truck },
    { key: "delivered", label: t('orders.status_delivered'), icon: CheckCircle },
  ];

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => OrderService.getOrderById(orderId!),
    enabled: !!orderId,
  });

  const order = data?.order;

  const { data: proposals } = useQuery({
    queryKey: ["order-proposals", orderId],
    queryFn: () => OrderService.getOrderProposals(orderId!),
    enabled: !!orderId,
  });

  const currentStep = order?.status ? (STATUS_STEP_MAP[order.status] ?? 0) : 0;
  const isCancelled = order?.status === CustomerOrderStatus.CANCELLED;
  const hasProposals = Array.isArray(proposals) && proposals.length > 0;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <AlertCircle size={48} className="text-error mb-4" />
        <h2 className="text-xl font-bold">{t('orders.order_not_found')}</h2>
        <button onClick={() => navigate("/orders")} className="mt-4 text-primary font-semibold text-sm">
          {t('common.go_back')}
        </button>
      </div>
    );
  }

  const vendorOrders: (VendorOrder & { items: any[] })[] = data?.vendorOrders || [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/orders")}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-soft text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={20} className={isRTL ? "rotate-180" : ""} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-text-primary">{t('orders.order_number')}{order.id.slice(-6).toUpperCase()}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Clock size={12} className="text-text-muted" />
            <span className="text-xs text-text-muted">{formatDateTime(order.createdAt)}</span>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-gray-100 transition-colors"
        >
          <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Status & Stepper */}
      <section className="bg-white rounded-2xl shadow-card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-text-primary">{t('orders.status')}</h2>
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: isCancelled ? "#FEF2F2" : "#ECFDF5",
              color: isCancelled ? "#EF4444" : "#10B981",
            }}
          >
            {order.status?.replace(/_/g, " ")}
          </span>
        </div>

        {!isCancelled && (
          <div className="relative">
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-100" />
            <div className="absolute top-5 left-5 h-0.5 bg-primary transition-all" style={{ width: `${(currentStep / (ORDER_STEPS.length - 1)) * 100}%` }} />
            <div className="flex justify-between relative z-10">
              {ORDER_STEPS.map((step, idx) => {
                const isCompleted = idx <= currentStep;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isCompleted ? "bg-primary text-white shadow-soft" : "bg-white border-2 border-border text-text-muted"
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <span className={`text-[10px] font-semibold text-center max-w-[60px] leading-tight ${isCompleted ? "text-primary" : "text-text-muted"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {order.cancellationReason && (
          <div className="flex items-start gap-3 bg-error-light border border-red-200 rounded-xl p-3 mt-4">
            <Ban size={16} className="text-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-error mb-0.5">{t('orders.cancellation_reason')}</p>
              <p className="text-xs text-red-700">{order.cancellationReason}</p>
            </div>
          </div>
        )}

        {hasProposals && (
          <Link to={`/orders/${orderId}/proposals`}>
            <motion.div whileHover={{ scale: 1.01 }} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4 cursor-pointer">
              <AlertCircle size={18} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm font-bold text-amber-700 flex-1">{t('proposals.info_text')}</p>
              <ChevronLeft size={16} className="text-amber-500 rotate-180" />
            </motion.div>
          </Link>
        )}
      </section>

      {/* Vendor Orders */}
      {vendorOrders.map((vo) => {
        const vcfg = VENDOR_STATUS_CONFIG[vo.status] ?? { label: vo.status, variant: "default" as const };
        return (
          <section key={vo.id} className="bg-white rounded-2xl shadow-card p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-primary-xlight rounded-xl flex items-center justify-center">
                <Package size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-text-primary text-sm">{vo.vendorName || t('common.vendor')}</p>
              </div>
              <Badge variant={vcfg.variant}>{vcfg.label}</Badge>
            </div>

            <div className="space-y-3">
              {vo.items?.map((item: any, idx: number) => (
                <div key={item.id} className={`flex justify-between items-start py-3 ${idx < vo.items.length - 1 ? "border-b border-border-light" : ""}`}>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-text-primary">{item.productName}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {item.quantity && (
                        <span className="text-xs text-text-muted">
                          {t('product.quantity')}: {item.quantity}
                          {item.proposedQuantity && item.proposedQuantity !== item.quantity && (
                            <span className="text-amber-600 font-semibold ml-1">→ {t('product.proposed_quantity')}: {item.proposedQuantity}</span>
                          )}
                        </span>
                      )}
                      {item.requestedWeightGrams && (
                        <span className="text-xs text-text-muted">
                          {t('orders.requested')}: {(item.requestedWeightGrams / 1000).toFixed(2)}{t('common.kg')}
                          {item.actualWeightGrams != null && (
                            <span className="text-primary font-semibold ml-1">{t('orders.actual_weight')}: {(item.actualWeightGrams / 1000).toFixed(2)}kg</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-text-primary text-sm ml-3">{formatPrice(item.totalPrice)}</span>
                </div>
              ))}
            </div>

            {vo.cancellationReason && (
              <div className="flex items-center gap-2 bg-error-light rounded-xl p-3 mt-3">
                <XCircle size={14} className="text-error flex-shrink-0" />
                <p className="text-xs text-error">{vo.cancellationReason}</p>
              </div>
            )}

            {vo.status === VendorOrderStatus.DELIVERED && (
              <button
                onClick={() => setRatingVendor({ id: vo.vendorId, name: vo.vendorName || t('common.vendor') })}
                className="mt-4 flex items-center gap-2 w-full justify-center py-2.5 bg-accent/10 text-accent text-sm font-bold rounded-xl hover:bg-accent/20 transition-colors"
              >
                <Star size={15} />
                {t('rating.rate_vendor')} {vo.vendorName}
              </button>
            )}
          </section>
        );
      })}

      {/* Delivery Address */}
      <section className="bg-white rounded-2xl shadow-card p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-primary-xlight rounded-xl flex items-center justify-center">
            <MapPin size={16} className="text-primary" />
          </div>
          <h2 className="font-bold text-text-primary text-sm">{t('checkout.address')}</h2>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed pl-12">{order.deliveryAddress}</p>
      </section>

      {/* Payment Summary */}
      <section className="bg-white rounded-2xl shadow-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-primary-xlight rounded-xl flex items-center justify-center">
            <Receipt size={16} className="text-primary" />
          </div>
          <h2 className="font-bold text-text-primary text-sm">{t('orders.payment_summary')}</h2>
        </div>
        <div className="space-y-2 pl-12">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">{t('cart.subtotal')}</span>
            <span className="font-semibold">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">{t('checkout.delivery_fee')}</span>
            <span className="font-semibold">{formatPrice(order.deliveryFee)}</span>
          </div>
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between">
            <span className="font-bold text-text-primary">{t('orders.total_amount')}</span>
            <span className="font-black text-xl text-primary">{formatPrice(order.totalAmount)}</span>
          </div>
        </div>
      </section>

      {/* Rating modal */}
      <RatingModal open={!!ratingVendor} onClose={() => setRatingVendor(null)} vendor={ratingVendor} orderId={orderId!} />
    </div>
  );
}
