import { getWebServerUrls } from "@city-market/shared/web";

// Production builds use the VITE_* URLs passed as Docker build args. In development,
// switch between `npm run dev` (:3000) and Docker (:80) with the badge in the
// bottom-left corner (or ?server=docker); VITE_DEV_SERVER_MODE sets the default.
export const { apiBaseUrl: API_BASE_URL, socketUrl: SOCKET_URL } = getWebServerUrls({
  isDev: import.meta.env.DEV,
  apiUrl: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL,
  socketUrl: import.meta.env.VITE_WEBSOCKET_URL,
  defaultMode: import.meta.env.VITE_DEV_SERVER_MODE,
});
