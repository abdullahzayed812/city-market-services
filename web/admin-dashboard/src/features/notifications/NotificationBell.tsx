import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NotificationItem } from "./NotificationItem";
import { notificationPath, useAdminNotifications, useNotificationActions } from "./useNotifications";
import type { AdminNotification } from "@/services/api/notifications.service";

// Navbar bell: unread count + the latest notifications. Updates live over the socket.
export const NotificationBell: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, unread, isLoading } = useAdminNotifications();
  const { markRead, markAllRead } = useNotificationActions();

  const open = (n: AdminNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    const path = notificationPath(n);
    if (path) navigate(path);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications.title")}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">{t("notifications.title")}</span>
          {unread > 0 && (
            <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              {t("notifications.mark_all_read")}
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y">
          {isLoading && <div className="p-6 text-center text-sm text-slate-500">{t("common.loading")}</div>}
          {!isLoading && items.length === 0 && <div className="p-6 text-center text-sm text-slate-500">{t("notifications.empty")}</div>}
          {items.slice(0, 8).map((n) => (
            <NotificationItem key={n.id} notification={n} onOpen={open} compact />
          ))}
        </div>
        <button type="button" className="w-full border-t px-3 py-2 text-sm text-indigo-600 hover:bg-slate-50" onClick={() => navigate("/notifications")}>
          {t("notifications.view_all")}
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
