import { config } from "../../config/env";

export class VendorClient {
  async getVendorIdForUser(authorizationHeader: string): Promise<string | null> {
    const response = await fetch(`${config.vendorServiceUrl}/vendors/me`, {
      headers: { Authorization: authorizationHeader },
    });

    if (!response.ok) return null;

    const json = (await response.json()) as { data?: { id?: string } };
    return json.data?.id ?? null;
  }
}
