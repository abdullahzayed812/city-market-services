import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setSignOutCallback } from '@/services/api/apiClient';
import type { User } from '@/types';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  signIn: (user: User, token: string, refreshToken: string) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      signIn: (user, token, refreshToken) => {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('refresh_token', refreshToken);
        set({ token, refreshToken, user, isAuthenticated: true });
      },

      signOut: () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

// Register sign-out callback so API client can trigger it on 401
setSignOutCallback(() => {
  useAuthStore.getState().signOut();
});
