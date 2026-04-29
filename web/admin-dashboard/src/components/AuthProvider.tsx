import React, { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/api/auth.service";

interface AuthContextType {
  user: any;
  token: string | null;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem("admin_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem("admin_token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const login = async (credentials: any) => {
    const data = await authService.login(credentials);

    localStorage.setItem("admin_token", data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem("admin_refresh_token", data.refreshToken);
    }
    if (data.user) {
      localStorage.setItem("admin_user", JSON.stringify(data.user));
      setUser(data.user);
    }
    setToken(data.accessToken);
  };

  const logout = async () => {
    // Best-effort server-side session invalidation
    try {
      const refreshToken = localStorage.getItem("admin_refresh_token");
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // ignore — we still clear local state
    }
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_refresh_token");
    localStorage.removeItem("admin_user");
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  return <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
