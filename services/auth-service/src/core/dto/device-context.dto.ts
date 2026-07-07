import { SessionPlatform } from "../entities/session.entity";

export interface DeviceContext {
  deviceId: string;
  platform?: SessionPlatform;
  browser?: string;
  os?: string;
  deviceName?: string;
  ipAddress?: string;
}
