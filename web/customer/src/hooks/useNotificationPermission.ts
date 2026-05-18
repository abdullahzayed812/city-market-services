import { useEffect, useCallback } from 'react';
import { useNotificationStore } from '@/store/notificationStore';

const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getBrowserPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Syncs the browser's Notification permission status into the Zustand store
 * and exposes a `requestPermission` function with a smart cooldown strategy.
 */
export function useNotificationPermission() {
  const {
    permissionStatus,
    lastPermissionPrompt,
    setPermissionStatus,
    setLastPermissionPrompt,
  } = useNotificationStore();

  // Sync on mount and whenever permission might change
  useEffect(() => {
    const status = getBrowserPermissionStatus();
    setPermissionStatus(status);
  }, [setPermissionStatus]);

  /**
   * Request browser notification permission.
   * Respects a 7-day cooldown to avoid nagging users after a dismissal.
   * Returns the resulting permission state.
   */
  const requestPermission =
    useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
      if (!('Notification' in window)) {
        setPermissionStatus('unsupported');
        return 'unsupported';
      }

      // Already granted or permanently denied — no need to ask
      if (Notification.permission !== 'default') {
        setPermissionStatus(Notification.permission);
        return Notification.permission;
      }

      // Enforce cooldown so we don't prompt every page load
      const now = Date.now();
      if (lastPermissionPrompt && now - lastPermissionPrompt < PROMPT_COOLDOWN_MS) {
        return Notification.permission;
      }

      setLastPermissionPrompt(now);

      try {
        const result = await Notification.requestPermission();
        setPermissionStatus(result);
        return result;
      } catch {
        // Some browsers throw if called outside a user gesture
        return Notification.permission;
      }
    }, [lastPermissionPrompt, setPermissionStatus, setLastPermissionPrompt]);

  /**
   * Whether to show the permission nudge banner.
   * Show only if:
   *   - Notifications are supported
   *   - Permission not yet granted or denied
   *   - We haven't asked recently
   */
  const shouldShowBanner =
    permissionStatus === 'default' &&
    (!lastPermissionPrompt || Date.now() - lastPermissionPrompt > PROMPT_COOLDOWN_MS);

  return {
    permissionStatus,
    isGranted: permissionStatus === 'granted',
    isDenied: permissionStatus === 'denied',
    isUnsupported: permissionStatus === 'unsupported',
    shouldShowBanner,
    requestPermission,
  };
}
