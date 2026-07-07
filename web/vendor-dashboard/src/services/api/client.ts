import axios from "axios";
import { getOrCreateDeviceId } from "@/utils/deviceId";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000/api/v1`;

// Access token lives in memory only — never localStorage/sessionStorage.
// The refresh token lives exclusively in the httpOnly cookie set by the backend.
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

let signOutCallback: (() => void) | null = null;
export const setSignOutCallback = (fn: () => void) => {
  signOutCallback = fn;
};

const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(
  (config) => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    config.headers["Accept-Language"] = localStorage.getItem("i18nextLng") || "ar";
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Refresh-token machinery ───────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)));
  failedQueue = [];
};

const clearSession = () => {
  setAccessToken(null);
  signOutCallback?.();
  window.location.href = "/login";
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        })
        .catch((err) => Promise.reject(err));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // Refresh token travels via the httpOnly cookie — only deviceId goes in the body.
      const { data } = await axios.post(
        `${BASE_URL}/auth/refresh`,
        { deviceId: getOrCreateDeviceId(), platform: "web" },
        { headers: { "Content-Type": "application/json" }, withCredentials: true },
      );
      const { accessToken: newAccessToken } = data.data;
      setAccessToken(newAccessToken);
      processQueue(null, newAccessToken);
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearSession();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

/** Attempt to silently re-establish an access token from the refresh cookie (called once on app bootstrap). */
export const silentRefresh = async (): Promise<{ accessToken: string; user: any } | null> => {
  try {
    const { data } = await axios.post(
      `${BASE_URL}/auth/refresh`,
      { deviceId: getOrCreateDeviceId(), platform: "web" },
      { headers: { "Content-Type": "application/json" }, withCredentials: true },
    );
    setAccessToken(data.data.accessToken);
    return data.data;
  } catch {
    return null;
  }
};

export default apiClient;
