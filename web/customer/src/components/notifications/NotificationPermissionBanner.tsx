import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, BellOff } from 'lucide-react';
import { useState } from 'react';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useAuthStore } from '@/store/authStore';

export function NotificationPermissionBanner() {
  const { isAuthenticated } = useAuthStore();
  const { shouldShowBanner, isDenied, requestPermission } = useNotificationPermission();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  const visible = isAuthenticated && !dismissed && (shouldShowBanner || isDenied);

  const handleAllow = async () => {
    setLoading(true);
    await requestPermission();
    setLoading(false);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="notif-banner"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="relative bg-gradient-to-r from-primary to-emerald-400 text-white px-4 py-3 flex items-center gap-3 shadow-medium"
        >
          {/* Icon */}
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            {isDenied ? <BellOff size={16} /> : <Bell size={16} />}
          </div>

          {/* Copy */}
          <div className="flex-1 min-w-0">
            {isDenied ? (
              <p className="text-sm font-semibold leading-snug">
                Notifications are blocked.{' '}
                <span className="opacity-80 font-normal">
                  Enable them in your browser settings to get order updates.
                </span>
              </p>
            ) : (
              <p className="text-sm font-semibold leading-snug">
                Get instant order updates!{' '}
                <span className="opacity-80 font-normal">
                  Enable notifications to stay updated on your deliveries.
                </span>
              </p>
            )}
          </div>

          {/* CTA */}
          {!isDenied && (
            <button
              onClick={handleAllow}
              disabled={loading}
              className="flex-shrink-0 bg-white text-primary text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-primary-light transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {loading ? 'Asking…' : 'Enable'}
            </button>
          )}

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
