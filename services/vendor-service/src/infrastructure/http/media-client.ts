import { vendorServiceAuthenticator, config } from "../../config/env";
import { Logger } from "@city-market/shared/node";

// Media URLs are full CDN URLs (https://cdn.example.com/{key}); R2 keys are the path.
export function extractMediaKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

export class MediaClient {
  async deleteFile(key: string): Promise<void> {
    const serviceToken = await vendorServiceAuthenticator.getServiceToken();

    const response = await fetch(`${config.mediaServiceUrl}/media/file`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({ key }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`media_delete_failed_${response.status}: ${body}`);
    }
  }

  async deleteOldImage(oldUrl: string | null | undefined, newUrl: string | null | undefined): Promise<void> {
    if (!oldUrl || oldUrl === newUrl) return;
    const key = extractMediaKey(oldUrl);
    if (!key) return;
    try {
      await this.deleteFile(key);
    } catch (error) {
      Logger.error("Failed to delete old media file", { key, error });
    }
  }
}
