import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '@/hooks/useSocket';
import { useFCM } from '@/hooks/useFCM';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { NotificationToastContainer } from '@/components/notifications/NotificationToast';

/**
 * NotificationProvider — mounts inside the Router so hooks can access navigate.
 *
 * Responsibilities:
 * 1. Establishes the Socket.IO realtime connection (useSocket)
 * 2. Manages FCM token registration + foreground messages (useFCM)
 * 3. Syncs browser notification permission state (useNotificationPermission)
 * 4. Registers the service worker for background push + PWA
 * 5. Handles SW → app navigation messages (notification click deep-link)
 * 6. Renders the foreground toast container
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  useSocket();
  useFCM();
  useNotificationPermission();

  const navigate = useNavigate();

  // ── Register service worker ────────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .then((registration) => {
        // Check for a waiting SW and activate it immediately
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });

        registration.addEventListener('updatefound', () => {
          const newSW = registration.installing;
          newSW?.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — activate silently
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => console.warn('[SW] Registration failed:', err));
  }, []);

  // ── Handle navigation messages from the service worker ────────────────────
  // When the user clicks a background notification, the SW sends a NAVIGATE
  // message to an already-open window instead of opening a new tab.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data.url) {
        const url = new URL(event.data.url);
        navigate(url.pathname + url.search);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [navigate]);

  return (
    <>
      {children}
      <NotificationToastContainer />
    </>
  );
}
