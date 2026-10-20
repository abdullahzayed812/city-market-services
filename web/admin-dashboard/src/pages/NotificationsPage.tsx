import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "@/features/notifications/NotificationItem";
import { notificationPath, useAdminNotifications, useNotificationActions } from "@/features/notifications/useNotifications";
import type { AdminNotification } from "@/services/api/notifications.service";

// Full notification history. Read state is stored on the server, shared with the admin app.
const NotificationsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, unread, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminNotifications();
  const { markRead, markAllRead } = useNotificationActions();

  const open = (n: AdminNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    const path = notificationPath(n);
    if (path) navigate(path);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t("notifications.title")}</h2>
          <p className="text-sm text-slate-500">{t("notifications.unread_count", { count: unread })}</p>
        </div>
        <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={unread === 0 || markAllRead.isPending}>
          {t("notifications.mark_all_read")}
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden divide-y">
        {isLoading && <div className="p-8 text-center">{t("common.loading")}</div>}
        {error && (
          <div className="p-8 text-center text-red-600">
            {t("common.error")}{" "}
            <button type="button" className="underline" onClick={() => refetch()}>
              {t("notifications.retry")}
            </button>
          </div>
        )}
        {!isLoading && !error && items.length === 0 && <div className="p-8 text-center text-slate-500">{t("notifications.empty")}</div>}
        {items.map((n) => (
          <NotificationItem key={n.id} notification={n} onOpen={open} />
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? t("common.loading") : t("notifications.load_more")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
