/// <reference lib="dom" />
/**
 * Where the web apps send API and socket traffic (browser only; mirrors
 * @city-market/mobile-ui's createServerConfig for the mobile apps).
 *
 * Production builds use the URLs baked in at build time (VITE_API_URL /
 * VITE_WEBSOCKET_URL, set as Docker build args). In development there are two
 * local setups:
 *   gateway - `npm run dev`: api-gateway on :3000, websocket-gateway on :3011
 *   docker  - `docker compose up`: nginx on :80 serves /api/v1 and /socket.io
 * The host is whatever the page was opened on (localhost, or your LAN IP from
 * another device). Switch with the dev badge in the corner, or ?server=docker.
 */
export type DevServerMode = "gateway" | "docker";

export interface WebServerConfigOptions {
  // Pass import.meta.env.DEV; this package isn't built by Vite
  isDev: boolean;
  // Production URLs (import.meta.env.VITE_API_URL / VITE_WEBSOCKET_URL)
  apiUrl?: string;
  socketUrl?: string;
  // Dev default before any switch (import.meta.env.VITE_DEV_SERVER_MODE)
  defaultMode?: string;
}

export interface WebServerUrls {
  apiBaseUrl: string;
  socketUrl: string;
  mode: DevServerMode | "production";
}

const MODE_KEY = "dev_server_mode";
const PORTS: Record<DevServerMode, { api: number; socket: number }> = {
  gateway: { api: 3000, socket: 3011 },
  docker: { api: 80, socket: 80 },
};
const MODE_LABELS: Record<DevServerMode, string> = {
  gateway: "npm run dev (:3000)",
  docker: "Docker (:80)",
};

const isMode = (value: unknown): value is DevServerMode => value === "gateway" || value === "docker";

const readMode = (fallback: DevServerMode): DevServerMode => {
  try {
    // ?server=docker|gateway switches and remembers the choice
    const fromUrl = new URLSearchParams(window.location.search).get("server");
    if (isMode(fromUrl)) {
      localStorage.setItem(MODE_KEY, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(MODE_KEY);
    return isMode(saved) ? saved : fallback;
  } catch {
    return fallback; // storage blocked
  }
};

const origin = (port: number) => {
  const { protocol, hostname } = window.location;
  return port === 80 ? `${protocol}//${hostname}` : `${protocol}//${hostname}:${port}`;
};

// Small fixed badge, dev only: shows the backend in use; click to switch and reload.
const mountDevBadge = (mode: DevServerMode) => {
  if (typeof document === "undefined" || document.getElementById("dev-server-badge")) return;
  const next: DevServerMode = mode === "gateway" ? "docker" : "gateway";
  const badge = document.createElement("button");
  badge.id = "dev-server-badge";
  badge.type = "button";
  badge.textContent = `API: ${MODE_LABELS[mode]}`;
  badge.title = `Click to switch to ${MODE_LABELS[next]}`;
  Object.assign(badge.style, {
    position: "fixed",
    bottom: "8px",
    left: "8px",
    zIndex: "2147483647",
    padding: "4px 8px",
    font: "600 11px/1.4 system-ui, sans-serif",
    color: "#fff",
    background: mode === "gateway" ? "#4f46e5" : "#0891b2",
    border: "none",
    borderRadius: "6px",
    opacity: "0.75",
    cursor: "pointer",
  });
  badge.onclick = () => {
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* storage blocked: nothing to persist */
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("server");
    window.location.replace(url.toString());
  };
  const attach = () => document.body.appendChild(badge);
  if (document.body) attach();
  else window.addEventListener("DOMContentLoaded", attach, { once: true });
};

export const getWebServerUrls = ({ isDev, apiUrl, socketUrl, defaultMode }: WebServerConfigOptions): WebServerUrls => {
  if (!isDev) {
    // Built without URLs: same origin as the page (nginx in front)
    return {
      apiBaseUrl: apiUrl || `${window.location.origin}/api/v1`,
      socketUrl: socketUrl || window.location.origin,
      mode: "production",
    };
  }

  const mode = readMode(isMode(defaultMode) ? defaultMode : "gateway");
  mountDevBadge(mode);
  return {
    apiBaseUrl: `${origin(PORTS[mode].api)}/api/v1`,
    socketUrl: origin(PORTS[mode].socket),
    mode,
  };
};
