import { create } from 'zustand';
import { setSignOutCallback, setAccessToken } from '@/services/api/apiClient';
import type { User } from '@/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  signIn: (user: User, token: string) => void;
  signOut: () => void;
}

// Access token is held only in memory (this store's in-process state, never
// persisted to localStorage/sessionStorage). The refresh token never reaches
// JS at all — it lives exclusively in the httpOnly cookie set by the backend.
export const useAuthStore = create<AuthState>()((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  signIn: (user, token) => {
    setAccessToken(token);
    set({ token, user, isAuthenticated: true });
  },

  signOut: () => {
    setAccessToken(null);
    set({ token: null, user: null, isAuthenticated: false });
  },
}));

// Register sign-out callback so API client can trigger it on 401
setSignOutCallback(() => {
  useAuthStore.getState().signOut();
});
