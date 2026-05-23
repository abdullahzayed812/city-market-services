import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  Package,
  AlertCircle,
  Info,
  Bike,
  ShoppingBag,
  CheckCircle,
  AlertTriangle,
  BellOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { NotificationService } from "@/services/api/notificationService";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/useLanguage";
import toast from "react-hot-toast";
import type { Notification } from "@/types";

// ── Icon / colour mapping ──────────────────────────────────────────────────────

function getNotificationMeta(type: string): {
  Icon: React.ElementType;
  iconClass: string;
  bgClass: string;
} {
  if (type.includes("DELIVERED")) {
    return { Icon: CheckCircle, iconClass: "text-success", bgClass: "bg-success-light" };
  }
  if (type.includes("ON_THE_WAY") || type.includes("PICKED_UP") || type.includes("COURIER")) {
    return { Icon: Bike, iconClass: "text-primary", bgClass: "bg-primary-xlight" };
  }
  if (type.includes("CANCELLED") || type.includes("FAILED")) {
    return { Icon: AlertTriangle, iconClass: "text-error", bgClass: "bg-error-light" };
  }
  if (type.includes("PROPOSED") || type.includes("AWAITING")) {
    return { Icon: AlertCircle, iconClass: "text-accent", bgClass: "bg-accent-xlight" };
  }
  if (type.includes("READY") || type.includes("CONFIRMED")) {
    return { Icon: Package, iconClass: "text-primary", bgClass: "bg-primary-xlight" };
  }
  if (type.includes("ORDER_CREATED") || type.includes("PURCHASE")) {
    return { Icon: ShoppingBag, iconClass: "text-primary", bgClass: "bg-primary-xlight" };
  }
  if (type.includes("SYSTEM") || type.includes("REGISTERED")) {
    return { Icon: Info, iconClass: "text-text-muted", bgClass: "bg-gray-100" };
  }
  return { Icon: Bell, iconClass: "text-text-muted", bgClass: "bg-gray-100" };
}

// ── Date grouping helpers ─────────────────────────────────────────────────────

function getGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "__today__";
  if (diffDays === 1) return "__yesterday__";
  if (diffDays < 7) return formatDate(dateStr);
  return formatDate(dateStr);
}

function groupNotifications(items: Notification[]): Array<{ label: string; items: Notification[] }> {
  const map = new Map<string, Notification[]>();
  items.forEach((n) => {
    const label = getGroupLabel(n.createdAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(n);
  });
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ── Permission status bar ─────────────────────────────────────────────────────

function PermissionBar() {
  const { permissionStatus, requestPermission } = useNotificationPermission();
  const { t } = useTranslation();

  if (permissionStatus === "granted" || permissionStatus === "unsupported") return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl mb-4 ${
        permissionStatus === "denied" ? "bg-error-light border border-red-200" : "bg-accent-xlight border border-amber-200"
      }`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${permissionStatus === "denied" ? "bg-error/10" : "bg-accent/10"}`}>
        {permissionStatus === "denied" ? <BellOff size={15} className="text-error" /> : <Bell size={15} className="text-accent" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-text-primary">
          {permissionStatus === "denied" ? t("notifications_page.blocked") : t("notifications_page.enable_push")}
        </p>
        <p className="text-xs text-text-muted">
          {permissionStatus === "denied" ? t("notifications_page.blocked_desc") : t("notifications_page.enable_push_desc")}
        </p>
      </div>
      {permissionStatus !== "denied" && (
        <button
          onClick={requestPermission}
          className="text-xs font-bold text-white bg-accent px-3 py-1.5 rounded-xl hover:bg-accent-dark transition-colors flex-shrink-0"
        >
          {t("notifications_page.enable")}
        </button>
      )}
    </motion.div>
  );
}

// ── Notification item ─────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

function NotificationItem({ notification: n, onMarkRead }: NotificationItemProps) {
  const { Icon, iconClass, bgClass } = getNotificationMeta(n.type);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      onClick={() => !n.isRead && onMarkRead(n.id)}
      className={`flex gap-3 p-4 rounded-2xl transition-all cursor-pointer group ${
        n.isRead ? "bg-white shadow-card hover:shadow-card-hover" : "bg-primary-xlight shadow-card border border-primary/10 hover:bg-primary/[0.08]"
      }`}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <Icon size={17} className={iconClass} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold mb-0.5 leading-snug ${n.isRead ? "text-text-primary" : "text-text-primary"}`}>{n.title}</p>
        <p className="text-xs text-text-muted leading-relaxed mb-1.5">{n.message}</p>
        <p className="text-[10px] text-text-muted">{formatDateTime(n.createdAt)}</p>
      </div>

      {/* Unread dot */}
      {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2 animate-pulse-soft" />}
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { soundEnabled, toggleSound } = useNotificationStore();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam = 1 }) => NotificationService.getNotifications(pageParam as number, 20),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.items.length === 20 ? pages.length + 1 : undefined),
    enabled: isAuthenticated,
  });

  const { data: countData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => NotificationService.getNotifications(1, 1),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: NotificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: NotificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
      toast.success(t("notifications_page.marked_all_read"));
    },
  });

  // Flatten paginated notifications
  const allNotifications = data?.pages.flatMap((p) => p.items) ?? [];
  const unreadCount = countData?.unread ?? 0;
  const groups = groupNotifications(allNotifications);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-soft text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={20} className={isRTL ? "rotate-180" : ""} />
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-text-primary">{t("notifications_page.title")}</h1>
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-primary text-white text-xs font-bold px-1"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          title={soundEnabled ? "Mute notification sounds" : "Unmute notification sounds"}
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
            soundEnabled ? "bg-primary-xlight text-primary-darker hover:bg-primary-light" : "bg-gray-100 text-text-muted hover:bg-gray-200"
          }`}
        >
          {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>

        {/* Mark all read */}
        {unreadCount > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="flex items-center gap-1.5 text-xs font-bold text-primary-darker hover:bg-primary-xlight px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <CheckCheck size={14} />
            <span className="hidden sm:inline">{t("notifications_page.mark_all_read")}</span>
          </button>
        )}
      </div>

      {/* Permission status */}
      <PermissionBar />

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
      ) : allNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 bg-primary-xlight rounded-full flex items-center justify-center mb-5">
            <Bell size={40} className="text-primary" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">{t("notifications_page.all_caught_up")}</h3>
          <p className="text-sm text-text-muted max-w-xs">{t("notifications_page.empty_desc")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence>
            {groups.map(({ label, items }) => (
              <div key={label}>
                {/* Group date label */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    {label === "__today__" ? t("notifications_page.today") : label === "__yesterday__" ? t("notifications_page.yesterday") : label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Notification items */}
                <div className="space-y-2">
                  {items.map((n) => (
                    <NotificationItem key={n.id} notification={n} onMarkRead={(id) => markReadMutation.mutate(id)} />
                  ))}
                </div>
              </div>
            ))}
          </AnimatePresence>

          {/* Load more */}
          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-6 py-2.5 text-sm font-semibold text-primary bg-primary-xlight hover:bg-primary-light rounded-xl transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage ? t("common.loading") : t("store.load_more")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
