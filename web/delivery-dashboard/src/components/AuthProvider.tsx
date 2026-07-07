import React, { createContext, useContext, useState, useEffect } from "react";
import { authService } from "@/services/api/auth.service";
import { setAccessToken, setSignOutCallback, silentRefresh } from "@/services/api/client";

interface AuthContextType {
  user: any;
  courier: any;
  token: string | null;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  logoutAllDevices: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [courier, setCourier] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSignOutCallback(() => {
      setToken(null);
      setUser(null);
      setCourier(null);
    });

    // Access token lives only in memory, so a hard page reload loses it —
    // silently re-establish one from the httpOnly refresh cookie on boot.
    (async () => {
      const result = await silentRefresh();
      if (result?.accessToken) {
        setToken(result.accessToken);
        if (result.user) {
          setUser(result.user);
          setCourier(result.user);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const login = async (credentials: any) => {
    const data = await authService.login(credentials);
    setAccessToken(data.accessToken);
    setToken(data.accessToken);
    if (data.user) {
      setUser(data.user);
      setCourier(data.user);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // ignore — still clear local state
    }
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setCourier(null);
    window.location.href = "/login";
  };

  const logoutAllDevices = async () => {
    try {
      await authService.logoutAll();
    } catch {
      // ignore — still clear local state
    }
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setCourier(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, courier, token, login, logout, logoutAllDevices, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
