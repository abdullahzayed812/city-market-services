import { SessionPlatform } from "../entities/session.entity";

export interface DeviceContext {
  deviceId: string;
  platform?: SessionPlatform;
  browser?: string;
  os?: string;
  deviceName?: string;
  ipAddress?: string;
  /**
   * Identifies which frontend app is calling (e.g. "admin-dashboard", "customer-web").
   * Used to namespace the auth cookies so independent apps in the same browser don't
   * clobber each other's session — the browser's cookie jar is keyed by domain, not by
   * which frontend origin made the request, so without this every web app calling the
   * same backend host shares one "refresh_token" cookie and silently steals whichever
   * app logged in last.
   */
  appId?: string;
}
