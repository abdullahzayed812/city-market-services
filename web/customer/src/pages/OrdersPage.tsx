import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, Clock, Calendar, ChevronRight, ShoppingBag } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { OrderService } from '@/services/api/orderService';
import { useAuthStore } from '@/store/authStore';
import { CustomerOrderStatus } from '@/types';
import { formatPrice } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useTranslation } from 'react-i18next';
import type { CustomerOrder } from '@/types';

function OrderCard({ order }: { order: CustomerOrder }) {
  const { t } = useTranslation();

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    [CustomerOrderStatus.PENDING_VENDOR_CONFIRMATION]: { label: t('orders.status_pending'), color: '#F59E0B' },
    [CustomerOrderStatus.WAITING_CUSTOMER_DECISION]: { label: t('orders.status_waiting_customer_decision'), color: '#F59E0B' },
    [CustomerOrderStatus.READY]: { label: t('orders.status_ready'), color: '#10B981' },
    [CustomerOrderStatus.IN_DELIVERY]: { label: t('orders.status_in_delivery'), color: '#10B981' },
    [CustomerOrderStatus.COMPLETED]: { label: t('orders.status_completed'), color: '#10B981' },
    [CustomerOrderStatus.CANCELLED]: { label: t('orders.status_cancelled'), color: '#EF4444' },
  };

  const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: '#9CA3AF' };
  const date = new Date(order.createdAt);
  const needsAction = order.status === CustomerOrderStatus.WAITING_CUSTOMER_DECISION;

  return (
    <Link to={`/orders/${order.id}`}>
      <motion.div
        whileHover={{ y: -2 }}
        className={`bg-white rounded-2xl shadow-card p-4 transition-shadow hover:shadow-medium ${
          needsAction ? 'ring-2 ring-amber-400' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary-xlight rounded-xl flex items-center justify-center">
              <Package size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary tracking-wider">
                #{order.id.slice(-6).toUpperCase()}
              </p>
              {needsAction && (
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">
                  {t('orders.status_waiting_customer_decision')}
                </p>
              )}
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

        <div className="h-px bg-border-light mb-3" />

        <div className="flex items-center gap-4 mb-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <Calendar size={12} />
            {date.toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-text-muted uppercase font-semibold tracking-wide mb-0.5">
              {t('orders.total_amount')}
            </p>
            <p className="text-lg font-black text-text-primary">{formatPrice(order.totalAmount)}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-primary bg-primary-xlight px-3.5 py-2 rounded-full">
            {needsAction ? t('orders.review') : t('orders.track')}
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

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['my-orders'],
      queryFn: ({ pageParam }) => OrderService.getMyOrders(pageParam),
      initialPageParam: 1,
      getNextPageParam: (lastPage, _, lastPageParam) =>
        lastPage.hasNextPage ? lastPageParam + 1 : undefined,
      enabled: isAuthenticated,
    });

  const orders = useMemo(
    () => data?.pages.flatMap((p) => p.items ?? []) ?? [],
    [data],
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <h1 className="text-2xl font-black text-text-primary tracking-tight mb-6">{t('orders.title')}</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-20 h-20 bg-primary-xlight rounded-full flex items-center justify-center mb-4">
            <Package size={36} className="text-primary" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">{t('orders.no_orders')}</h3>
          <p className="text-sm text-text-muted mb-6 max-w-xs">
            {t('orders.no_orders_hint')}
          </p>
          <Button onClick={() => navigate('/')}>{t('home.stores')}</Button>
        </motion.div>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-6 py-3 bg-white border border-border text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage ? t('common.loading') : t('store.load_more')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
