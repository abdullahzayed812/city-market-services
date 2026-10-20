import { translate } from "@city-market/shared";
import type { AdminNotification } from "@/services/api/notifications.service";

// Stored notifications carry their translation keys, so they show in the admin's current
// language; older rows (no keys) fall back to the stored English text.
export const notificationText = (n: Pick<AdminNotification, "title" | "message" | "metadata">, lang: string) => {
  const meta = n.metadata ?? {};
  const params = { ...meta, orderId: meta.orderId ?? (meta.customerOrderId ? String(meta.customerOrderId).slice(0, 6) : undefined) };
  const titleKey = typeof meta.titleKey === "string" ? meta.titleKey : null;
  const messageKey = typeof meta.messageKey === "string" ? meta.messageKey : null;
  return {
    title: titleKey ? translate(titleKey, lang, params) : n.title,
    message: messageKey ? translate(messageKey, lang, params) : n.message,
  };
};
