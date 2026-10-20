import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminQueryKeys, adminNotificationTarget, type AdminNotificationTarget } from "@city-market/shared";
import { notificationsApi, type AdminNotification } from "@/services/api/notifications.service";

const PAGE_SIZE = 20;

// Paged notification history (newest first) plus the unread count from the latest page.
// Socket events (NOTIFICATION_CREATED / NOTIFICATION_READ) invalidate this key, so it stays live.
export const useAdminNotifications = () => {
  const query = useInfiniteQuery({
    queryKey: [AdminQueryKeys.notifications],
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.total ? pages.length + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = query.data?.pages[0]?.unread ?? 0;
  return { ...query, items, unread };
};

export const useNotificationActions = () => {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: [AdminQueryKeys.notifications] });
  const markRead = useMutation({ mutationFn: (id: string) => notificationsApi.markRead(id), onSettled: refresh });
  const markAllRead = useMutation({ mutationFn: () => notificationsApi.markAllRead(), onSettled: refresh });
  return { markRead, markAllRead };
};

// Dashboard route for a notification's subject (the page opens that record's review dialog)
export const notificationPath = (n: Pick<AdminNotification, "metadata">): string | null => {
  const target: AdminNotificationTarget = adminNotificationTarget(n.metadata);
  if (!target) return null;
  switch (target.screen) {
    case "vendor":
      return `/vendors?review=${encodeURIComponent(target.id)}`;
    case "courier":
      return `/couriers?view=${encodeURIComponent(target.id)}`;
    case "office":
      return `/delivery-offices?view=${encodeURIComponent(target.id)}`;
    case "submission":
      return `/product-submissions?view=${encodeURIComponent(target.id)}`;
    case "order":
      return `/orders?order=${encodeURIComponent(target.id)}`;
  }
};
