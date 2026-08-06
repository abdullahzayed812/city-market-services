import { config } from "../../config/env";
import { Logger } from "@city-market/shared/node";

export class VendorClient {
  async getVendorIdForUser(authorizationHeader: string): Promise<string | null> {
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

    const json = (await response.json()) as { data?: { id?: string } };
    return json.data?.id ?? null;
  }
}
