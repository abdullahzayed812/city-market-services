import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Package, Bike, CheckCircle, AlertTriangle, Bell } from 'lucide-react';
import { useEffect } from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import type { LiveNotification } from '@/types';

const AUTO_DISMISS_MS = 5500;

/** Maps socket event type → icon component + accent color */
function getToastMeta(type: string): {
  Icon: React.ElementType;
  color: string;
  bg: string;
} {
  if (type.includes('DELIVERED') || type.includes('REGISTERED')) {
    return { Icon: CheckCircle, color: 'text-success', bg: 'bg-success-light' };
  }
  if (type.includes('ON_THE_WAY') || type.includes('PICKED_UP') || type.includes('COURIER')) {
    return { Icon: Bike, color: 'text-primary', bg: 'bg-primary-xlight' };
  }
  if (type.includes('CANCELLED') || type.includes('FAILED')) {
    return { Icon: AlertTriangle, color: 'text-error', bg: 'bg-error-light' };
  }
  if (type.includes('PROPOSED') || type.includes('AWAITING')) {
    return { Icon: AlertTriangle, color: 'text-accent', bg: 'bg-accent-xlight' };
  }
  if (type.includes('READY') || type.includes('CONFIRMED')) {
    return { Icon: Package, color: 'text-primary', bg: 'bg-primary-xlight' };
  }
  if (type.includes('ORDER_CREATED')) {
    return { Icon: ShoppingBag, color: 'text-primary', bg: 'bg-primary-xlight' };
  }
  return { Icon: Bell, color: 'text-text-muted', bg: 'bg-gray-100' };
}

interface SingleToastProps {
  notification: LiveNotification;
  index: number;
}

function SingleToast({ notification, index }: SingleToastProps) {
  const { dismissToast } = useNotificationStore();
  const { Icon, color, bg } = getToastMeta(notification.type);

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(notification.id), AUTO_DISMISS_MS - index * 500);
    return () => clearTimeout(timer);
  }, [notification.id, index, dismissToast]);

  return (
    <motion.div
      layout
      key={notification.id}
      initial={{ opacity: 0, x: 60, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.93 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="w-80 bg-white rounded-2xl shadow-large border border-gray-100 overflow-hidden"
      style={{ marginBottom: index > 0 ? 8 : 0 }}
    >
      {/* Progress bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: (AUTO_DISMISS_MS - index * 500) / 1000, ease: 'linear' }}
        className="h-0.5 bg-primary origin-left"
      />

      <div className="p-4 flex items-start gap-3">
        {/* Icon */}
        <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <Icon size={17} className={color} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text-primary leading-snug mb-0.5">
            {notification.title}
          </p>
          <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
            {notification.message}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => dismissToast(notification.id)}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-text-muted hover:bg-gray-100 hover:text-text-primary transition-colors flex-shrink-0 mt-0.5"
          aria-label="Dismiss notification"
        >
          <X size={13} />
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Renders up to 3 stacked realtime notification toasts in the top-right corner.
 * Toasts auto-dismiss and are driven by the Zustand notification store.
 */
export function NotificationToastContainer() {
  const toastQueue = useNotificationStore((s) => s.toastQueue);

  return (
    <div
      className="fixed top-20 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence mode="sync">
        {toastQueue.map((notification, index) => (
          <div key={notification.id} className="pointer-events-auto">
            <SingleToast notification={notification} index={index} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
