import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n";
import { ADMIN_REALTIME_EVENTS, AdminQueryKeys, EventType, RecentEventIds, adminInvalidationsFor } from "@city-market/shared";
import { toast } from "@/hooks/use-toast";
import { notificationText } from "@/lib/notification-text";
import type { AdminNotification } from "@/services/api/notifications.service";

interface RealtimePayload {
  eventId?: string;
  resource?: string;
  notification?: AdminNotification;
}

// Bursts of events (an order moving through several states) are collapsed into one refetch per key
const FLUSH_MS = 250;

// Every admin page refreshes live: each socket event invalidates the queries that depend on it
// (shared rules in @city-market/shared), and the active ones refetch with their own filters/page.
export const useAdminRealtime = (socket: Socket | null) => {
  const queryClient = useQueryClient();
  const seen = useRef(new RecentEventIds());

  useEffect(() => {
    if (!socket) return;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      pending.forEach((root) => queryClient.invalidateQueries({ queryKey: [root] }));
      pending.clear();
    };
    const schedule = (roots: readonly string[]) => {
      roots.forEach((r) => pending.add(r));
      if (!timer && pending.size) timer = setTimeout(flush, FLUSH_MS);
    };

    const onDomainEvent = (type: string) => (payload: RealtimePayload) => {
      if (!seen.current.firstSeen(payload?.eventId)) return;
      schedule(adminInvalidationsFor(type, payload));
    };
    const handlers = ADMIN_REALTIME_EVENTS.map((type) => [type, onDomainEvent(type)] as const);
    handlers.forEach(([type, fn]) => socket.on(type, fn));

    const onNotification = (payload: RealtimePayload) => {
      if (!seen.current.firstSeen(payload?.eventId)) return;
      schedule([AdminQueryKeys.notifications]);
      const n = payload?.notification;
      if (n) {
        const { title, message } = notificationText(n, i18n.language);
        toast({ title, description: message });
      }
    };
    const onRead = (payload: RealtimePayload) => {
      if (!seen.current.firstSeen(payload?.eventId)) return;
      schedule([AdminQueryKeys.notifications]);
    };
    socket.on(EventType.NOTIFICATION_CREATED, onNotification);
    socket.on(EventType.NOTIFICATION_READ, onRead);

    return () => {
      handlers.forEach(([type, fn]) => socket.off(type, fn));
      socket.off(EventType.NOTIFICATION_CREATED, onNotification);
      socket.off(EventType.NOTIFICATION_READ, onRead);
      clearTimeout(timer);
    };
  }, [socket, queryClient]);
};
