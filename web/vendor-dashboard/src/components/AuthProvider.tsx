import React, { createContext, useContext, useState, useEffect } from "react";
import { authService } from "@/services/api/auth.service";
import { vendorService } from "@/services/api/vendor.service";

interface AuthContextType {
  user: any;
  vendor: any;
  token: string | null;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem("vendor_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [vendor, setVendor] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("vendor_token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (user) {
        try {
          // Fetch the vendor profile to ensure we have the correct vendor.id
          const vendorProfile = await vendorService.getMyProfile();
          setVendor(vendorProfile);
        } catch (error) {
          console.error("Failed to fetch vendor profile:", error);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [user]);

  const login = async (credentials: any) => {
    const data = await authService.login(credentials);

    localStorage.setItem("vendor_token", data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem("vendor_refresh_token", data.refreshToken);
    }
    setToken(data.accessToken);

    if (data.user) {
      localStorage.setItem("vendor_user", JSON.stringify(data.user));
      setUser(data.user);

      // Fetch vendor profile immediately after login
      try {
        const vendorProfile = await vendorService.getMyProfile();
        setVendor(vendorProfile);
      } catch (error) {
        console.error("Failed to fetch vendor profile:", error);
      }
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem("vendor_refresh_token");
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // ignore — still clear local state
    }
    localStorage.removeItem("vendor_token");
    localStorage.removeItem("vendor_refresh_token");
    localStorage.removeItem("vendor_user");
    setToken(null);
    setUser(null);
    setVendor(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, vendor, token, login, logout, isLoading }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
