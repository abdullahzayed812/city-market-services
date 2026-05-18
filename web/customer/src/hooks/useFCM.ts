import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getFirebaseMessaging, getToken, onMessage, firebaseConfig } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { NotificationService } from '@/services/api/notificationService';
import { playNotificationSound } from '@/lib/notificationSound';
import type { MessagePayload } from '@/lib/firebase';
import type { LiveNotification } from '@/types';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

/**
 * Sends the Firebase config to the service worker so it can handle
 * background push messages. Called once after SW registration.
 */
async function sendConfigToServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config: firebaseConfig,
      });
    }
    return registration;
  } catch {
    return undefined;
  }
}

/**
 * Manages the full FCM lifecycle for web:
 * - Obtains and registers the FCM token when permission is granted
 * - Listens for foreground messages and shows toast notifications
 * - Cleans up the token on sign-out
 */
export function useFCM() {
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const {
    permissionStatus,
    fcmToken,
    soundEnabled,
    setFcmToken,
    enqueueToast,
  } = useNotificationStore();

  /** Convert an FCM foreground message payload into a LiveNotification toast */
  const handleForegroundMessage = useCallback(
    (payload: MessagePayload) => {
      const title = payload.notification?.title ?? payload.data?.title ?? 'CityMarket';
      const message =
        payload.notification?.body ?? payload.data?.body ?? 'You have a new notification';
      const type = payload.data?.type ?? 'NOTIFICATION';

      const toast: LiveNotification = {
        id: `fcm-${Date.now()}`,
        title,
        message,
        type,
        timestamp: Date.now(),
      };

      if (soundEnabled) playNotificationSound();
      enqueueToast(toast);

      // Refresh notification list + badge
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    [soundEnabled, enqueueToast, queryClient],
  );

  // ── Token registration ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || permissionStatus !== 'granted' || !VAPID_KEY) return;

    let cancelled = false;

    async function register() {
      const messaging = await getFirebaseMessaging();
      if (!messaging || cancelled) return;

      try {
        const swRegistration = await sendConfigToServiceWorker();

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
        });

        if (cancelled || !token) return;

        // Only hit the API if the token changed
        if (token !== fcmToken) {
          setFcmToken(token);
          await NotificationService.registerDeviceToken(token);
        }
      } catch (err) {
        console.warn('[FCM] Token registration failed:', err);
      }
    }

    register();
    return () => { cancelled = true; };
  }, [isAuthenticated, permissionStatus, fcmToken, setFcmToken]);

  // ── Foreground message listener ─────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || permissionStatus !== 'granted') return;

    let unsubscribe: (() => void) | null = null;

    getFirebaseMessaging().then((messaging) => {
      if (!messaging) return;
      unsubscribe = onMessage(messaging, handleForegroundMessage);
    });

    return () => { unsubscribe?.(); };
  }, [isAuthenticated, permissionStatus, handleForegroundMessage]);

  // ── Token cleanup on sign-out ───────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) return;

    // User just signed out — clean up the stored token
    const token = useNotificationStore.getState().fcmToken;
    if (token) {
      NotificationService.unregisterDeviceToken(token).catch(() => {});
      setFcmToken(null);
    }
  }, [isAuthenticated, setFcmToken]);
}
