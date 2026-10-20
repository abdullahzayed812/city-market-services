import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../components/AuthProvider";
import { getAccessToken, silentRefresh } from "../services/api/axios-instance";
import { useAdminRealtime } from "../hooks/useAdminRealtime";

import { SOCKET_URL } from "@/lib/server-config";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const signedIn = !!token && !!user;

  useEffect(() => {
    if (!signedIn) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    // The access token is read on every (re)connection attempt, so a reconnect after the
    // token was refreshed doesn't present the expired one it first connected with.
    const newSocket = io(SOCKET_URL, {
      auth: (cb) => cb({ token: getAccessToken() }),
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
    });

    let connectedOnce = false;
    let lastRefreshAt = 0;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    newSocket.on("connect", () => {
      setIsConnected(true);
      // Anything that changed while we were disconnected: refetch what's on screen
      if (connectedOnce) queryClient.invalidateQueries();
      connectedOnce = true;
    });

    newSocket.on("disconnect", () => setIsConnected(false));

    newSocket.on("connect_error", async (err) => {
      setIsConnected(false);
      // Expired access token: get a fresh one, then let socket.io retry with it
      // (at most every 30 s, so a token the server keeps refusing can't loop)
      if (err.message.includes("Authentication error") && Date.now() - lastRefreshAt > 30_000) {
        lastRefreshAt = Date.now();
        newSocket.disconnect();
        const refreshed = await silentRefresh();
        if (refreshed?.accessToken && !disposed) newSocket.connect();
      } else if (!newSocket.active) {
        // Refused by the server's auth middleware: socket.io won't retry on its own
        retryTimer = setTimeout(() => !disposed && newSocket.connect(), 15_000);
      }
    });

    setSocket(newSocket);

    // Back on the tab after a while: resync (the browser may have throttled the socket)
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!newSocket.connected) newSocket.connect();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      newSocket.disconnect();
    };
    // Reconnect only when the signed-in state changes, not on every token refresh
  }, [signedIn, queryClient]);

  useAdminRealtime(socket);

  return <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
