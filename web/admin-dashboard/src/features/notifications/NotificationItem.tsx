import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { notificationText } from "@/lib/notification-text";
import type { AdminNotification } from "@/services/api/notifications.service";

export const NotificationItem: React.FC<{ notification: AdminNotification; onOpen: (n: AdminNotification) => void; compact?: boolean }> = ({
  notification: n,
  onOpen,
  compact,
}) => {
  const { i18n } = useTranslation();
  const { title, message } = notificationText(n, i18n.language);
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn("w-full text-start flex gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors", !n.isRead && "bg-indigo-50/60")}
    >
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-indigo-600")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", n.isRead ? "text-slate-700" : "font-semibold text-slate-900")}>{title}</span>
        <span className={cn("block text-xs text-slate-500", compact && "line-clamp-2")}>{message}</span>
        <span className="block text-[11px] text-slate-400 mt-0.5">{new Date(n.createdAt).toLocaleString(i18n.language)}</span>
      </span>
    </button>
  );
};
