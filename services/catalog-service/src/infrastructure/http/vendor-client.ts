import { config } from "../../config/env";
import { Logger } from "@city-market/shared/node";

export interface OwnVendor {
  id: string;
  approvalStatus?: string;
  isActive?: boolean;
}

export class VendorClient {
  // The caller's own store, read live from vendor-service with the caller's token, so an
  // admin's approval / suspension applies on the very next request (nothing is cached).
  async getOwnVendor(authorizationHeader: string): Promise<OwnVendor | null> {
    let response: Response;
    try {
      response = await fetch(`${config.vendorServiceUrl}/me`, {
        headers: { Authorization: authorizationHeader },
      });
    } catch (error: any) {
      Logger.error("VendorClient: failed to reach vendor-service", {
        vendorServiceUrl: config.vendorServiceUrl,
        error: error?.message ?? error,
      });
      return null;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      Logger.error("VendorClient: /me returned a non-OK response", {
        vendorServiceUrl: config.vendorServiceUrl,
        status: response.status,
        body,
      });
      return null;
    }

    const json = (await response.json()) as { data?: OwnVendor };
    return json.data?.id ? json.data : null;
  }

  async getVendorIdForUser(authorizationHeader: string): Promise<string | null> {
    return (await this.getOwnVendor(authorizationHeader))?.id ?? null;
  }
}
