import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { playNotificationSound } from '@/lib/notificationSound';
import type { LiveNotification, SocketEventPayload } from '@/types';

const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || '';

// All events a CUSTOMER can receive
const CUSTOMER_EVENTS = [
  'ORDER_CREATED',
  'ORDER_CONFIRMED',
  'ORDER_CANCELLED',
  'ORDER_READY',
  'ORDER_ON_THE_WAY',
  'ORDER_PICKED_UP',
  'ORDER_DELIVERED',
  'ORDER_AWAITING_CUSTOMER_CONFIRMATION',
  'COURIER_ASSIGNED',
  'VENDOR_ORDER_CONFIRMED',
  'VENDOR_ORDER_PROPOSED',
  'VENDOR_ORDER_CANCELLED',
  'DELIVERY_FAILED',
  'DELIVERY_CANCELLED_BY_COURIER',
  'USER_REGISTERED',
  'PROPOSAL_ACCEPTED',
  'PROPOSAL_REJECTED',
  'ORDER_PREPARING',
] as const;

type CustomerEvent = (typeof CUSTOMER_EVENTS)[number];

/** Human-readable label for each socket event type */
const EVENT_LABELS: Record<CustomerEvent, { title: string; message: string }> = {
  ORDER_CREATED: {
    title: '✅ Order Placed',
    message: 'Your order has been placed successfully!',
  },
  ORDER_CONFIRMED: {
    title: 'Order Confirmed',
    message: 'Your order has been confirmed.',
  },
  ORDER_CANCELLED: {
    title: 'Order Cancelled',
    message: 'Your order has been cancelled.',
  },
  ORDER_READY: {
    title: '🎉 Order Ready',
    message: 'Your order is packed and ready — a courier is being assigned.',
  },
  ORDER_ON_THE_WAY: {
    title: '🛵 On the Way',
    message: 'Your order is on its way to you!',
  },
  ORDER_PICKED_UP: {
    title: '🛵 Picked Up',
    message: 'Your order has been picked up and is heading your way!',
  },
  ORDER_DELIVERED: {
    title: '🏠 Delivered!',
    message: 'Your order has been delivered. Enjoy your meal!',
  },
  ORDER_AWAITING_CUSTOMER_CONFIRMATION: {
    title: '⚠️ Action Required',
    message: 'Your order needs your confirmation. Please review and respond.',
  },
  COURIER_ASSIGNED: {
    title: '🚴 Courier Assigned',
    message: 'A courier has been assigned to deliver your order.',
  },
  VENDOR_ORDER_CONFIRMED: {
    title: 'Items Confirmed',
    message: 'The vendor has confirmed items in your order.',
  },
  VENDOR_ORDER_PROPOSED: {
    title: '🔄 Changes Proposed',
    message: 'A vendor has proposed changes to your order. Please review.',
  },
  VENDOR_ORDER_CANCELLED: {
    title: 'Partial Cancellation',
    message: 'A vendor has cancelled part of your order.',
  },
  DELIVERY_FAILED: {
    title: '❌ Delivery Issue',
    message: 'There was an issue delivering your order. Please contact support.',
  },
  DELIVERY_CANCELLED_BY_COURIER: {
    title: 'Courier Cancelled',
    message: 'Your courier cancelled. A new one will be assigned shortly.',
  },
  USER_REGISTERED: {
    title: '👋 Welcome!',
    message: 'Welcome to CityMarket! Explore fresh groceries near you.',
  },
  PROPOSAL_ACCEPTED: {
    title: 'Proposal Accepted',
    message: 'Your order has been updated with the accepted changes.',
  },
  PROPOSAL_REJECTED: {
    title: 'Proposal Rejected',
    message: 'The proposed changes were rejected.',
  },
  ORDER_PREPARING: {
    title: '👨‍🍳 Preparing',
    message: 'The vendor is now preparing your order.',
  },
};

/** Which TanStack Query keys to invalidate per event */
const QUERIES_TO_INVALIDATE: Partial<Record<CustomerEvent, string[][]>> = {
  ORDER_CREATED: [['orders'], ['notifications-count'], ['notifications']],
  ORDER_CONFIRMED: [['orders'], ['notifications-count'], ['notifications']],
  ORDER_CANCELLED: [['orders'], ['notifications-count'], ['notifications']],
  ORDER_READY: [['orders'], ['notifications-count'], ['notifications']],
  ORDER_ON_THE_WAY: [['orders'], ['notifications-count'], ['notifications']],
  ORDER_PICKED_UP: [['orders'], ['notifications-count'], ['notifications']],
  ORDER_DELIVERED: [['orders'], ['notifications-count'], ['notifications']],
  ORDER_AWAITING_CUSTOMER_CONFIRMATION: [['orders'], ['notifications-count'], ['notifications']],
  COURIER_ASSIGNED: [['orders'], ['notifications-count'], ['notifications']],
  VENDOR_ORDER_CONFIRMED: [['orders'], ['notifications-count'], ['notifications']],
  VENDOR_ORDER_PROPOSED: [['orders'], ['notifications-count'], ['notifications']],
  VENDOR_ORDER_CANCELLED: [['orders'], ['notifications-count'], ['notifications']],
  DELIVERY_FAILED: [['orders'], ['notifications-count'], ['notifications']],
  DELIVERY_CANCELLED_BY_COURIER: [['orders'], ['notifications-count'], ['notifications']],
  PROPOSAL_ACCEPTED: [['orders'], ['notifications-count'], ['notifications']],
  PROPOSAL_REJECTED: [['orders'], ['notifications-count'], ['notifications']],
  ORDER_PREPARING: [['orders'], ['notifications-count'], ['notifications']],
};

export function useSocket() {
  const { token, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  // Use refs for callback values so the socket event handlers never go stale
  // without having to reconnect
  const soundEnabledRef = useRef(useNotificationStore.getState().soundEnabled);
  const enqueueToastRef = useRef(useNotificationStore.getState().enqueueToast);
  const setConnectedRef = useRef(useNotificationStore.getState().setSocketConnected);

  // Keep refs in sync with store
  useEffect(() =>
    useNotificationStore.subscribe((state) => {
      soundEnabledRef.current = state.soundEnabled;
      enqueueToastRef.current = state.enqueueToast;
    }),
  []);

  const handleEvent = useCallback(
    (eventType: CustomerEvent, payload: SocketEventPayload) => {
      const label = EVENT_LABELS[eventType];
      if (!label) return;

      // Enrich toast with order ID if available
      const orderId =
        (payload.customerOrderId as string) || (payload.orderId as string) || '';

      const toast: LiveNotification = {
        id: `${eventType}-${Date.now()}`,
        title: label.title,
        message: label.message,
        type: eventType,
        timestamp: Date.now(),
      };

      // Play sound + show foreground toast
      if (soundEnabledRef.current) playNotificationSound();
      enqueueToastRef.current(toast);

      // Invalidate relevant query caches
      const keys = QUERIES_TO_INVALIDATE[eventType] ?? [
        ['notifications-count'],
        ['notifications'],
      ];
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));

      // Also invalidate the specific order detail if we know the ID
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      }
    },
    [queryClient],
  );

  // Keep handleEvent ref so socket callbacks use the latest version
  const handleEventRef = useRef(handleEvent);
  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent]);

  useEffect(() => {
    if (!isAuthenticated || !token || !WS_URL) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnectedRef.current(false);
      return;
    }

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: Infinity,
      timeout: 10_000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectedRef.current(true);
    });

    socket.on('disconnect', () => {
      setConnectedRef.current(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] connection error:', err.message);
    });

    CUSTOMER_EVENTS.forEach((eventType) => {
      socket.on(eventType, (payload: SocketEventPayload) => {
        handleEventRef.current(eventType, payload);
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnectedRef.current(false);
    };
  }, [isAuthenticated, token]); // Reconnect only when auth state changes
}
