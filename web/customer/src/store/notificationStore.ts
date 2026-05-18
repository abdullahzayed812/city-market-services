import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LiveNotification, NotificationPermissionStatus } from '@/types';

interface NotificationState {
  // ── Persisted settings ─────────────────────────────────────────────────────
  soundEnabled: boolean;
  fcmToken: string | null;
  // Tracks when we last prompted for permission (to avoid spamming)
  lastPermissionPrompt: number | null;

  // ── Runtime state (not persisted) ─────────────────────────────────────────
  permissionStatus: NotificationPermissionStatus;
  socketConnected: boolean;
  // Queue of toasts to show — up to 3 visible at once
  toastQueue: LiveNotification[];

  // ── Actions ────────────────────────────────────────────────────────────────
  toggleSound: () => void;
  setFcmToken: (t: string | null) => void;
  setPermissionStatus: (s: NotificationPermissionStatus) => void;
  setSocketConnected: (v: boolean) => void;
  enqueueToast: (n: LiveNotification) => void;
  dismissToast: (id: string) => void;
  setLastPermissionPrompt: (ts: number) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      // Persisted defaults
      soundEnabled: true,
      fcmToken: null,
      lastPermissionPrompt: null,

      // Runtime defaults
      permissionStatus: 'default',
      socketConnected: false,
      toastQueue: [],

      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      setFcmToken: (fcmToken) => set({ fcmToken }),

      setPermissionStatus: (permissionStatus) => set({ permissionStatus }),

      setSocketConnected: (socketConnected) => set({ socketConnected }),

      enqueueToast: (n) =>
        set((s) => ({
          // Keep at most 3 toasts; newest first
          toastQueue: [n, ...s.toastQueue].slice(0, 3),
        })),

      dismissToast: (id) =>
        set((s) => ({ toastQueue: s.toastQueue.filter((t) => t.id !== id) })),

      setLastPermissionPrompt: (ts) => set({ lastPermissionPrompt: ts }),
    }),
    {
      name: 'cm-notification-prefs',
      // Only persist user preferences + token; runtime state rehydrates itself
      partialize: (s) => ({
        soundEnabled: s.soundEnabled,
        fcmToken: s.fcmToken,
        lastPermissionPrompt: s.lastPermissionPrompt,
      }),
    },
  ),
);
