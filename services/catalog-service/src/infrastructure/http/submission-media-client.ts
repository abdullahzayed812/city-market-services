import { AppError } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { catalogServiceAuthenticator, config } from "../../config/env";
import { ISubmissionMedia, SubmissionImageInfo } from "../../core/interfaces/submission-media";

// Calls media-service with catalog-service's own service token: the private-photo endpoints
// accept service tokens only. Responses with signed URLs are never logged.
export class SubmissionMediaClient implements ISubmissionMedia {
  private async call<T>(method: string, path: string, body: unknown, failure: string): Promise<T> {
    let response: Response;
    try {
      const token = await catalogServiceAuthenticator.getServiceToken();
      response = await fetch(`${config.mediaServiceUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } catch (error: any) {
      Logger.error(`[SubmissionMediaClient] ${path} unreachable`, { error: error?.message ?? String(error) });
      throw new AppError(503, "private_storage_unavailable");
    }
    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { message?: string } | null;
      Logger.error(`[SubmissionMediaClient] ${path} failed`, { status: response.status, message: json?.message });
      // media-service's own validation codes (e.g. image_too_small) are passed on
      if (response.status === 400 && json?.message) throw new AppError(400, json.message);
      if (response.status === 404) throw new AppError(404, "submission_image_missing");
      throw new AppError(response.status === 503 ? 503 : 502, failure);
    }
    const json = (await response.json()) as { data: T };
    return json.data;
  }

  stat(key: string): Promise<SubmissionImageInfo> {
    return this.call("POST", "/media/private/stat", { key }, "private_storage_unavailable");
  }

  async signedUrls(keys: string[]): Promise<Record<string, string>> {
    if (keys.length === 0) return {};
    try {
      const data = await this.call<{ urls: Record<string, string> }>("POST", "/media/private/signed-urls", { keys }, "private_storage_unavailable");
      return data.urls ?? {};
    } catch {
      // A missing preview must not break the page
      return {};
    }
  }

  promote(key: string, globalProductId: string): Promise<{ url: string }> {
    return this.call("POST", "/media/private/promote", { key, folder: "globals", entityId: globalProductId }, "image_promotion_failed");
  }

  async deletePrivate(key: string): Promise<void> {
    await this.call("DELETE", "/media/private", { key }, "private_storage_unavailable");
  }

  async deletePublicFolder(globalProductId: string): Promise<void> {
    await this.call("DELETE", "/media/folder", { folder: "globals", entityId: globalProductId }, "private_storage_unavailable");
  }

  async listPrivateOlderThan(olderThanSeconds: number, limit: number): Promise<string[]> {
    const data = await this.call<{ keys: string[] }>("POST", "/media/private/list", { olderThanSeconds, limit }, "private_storage_unavailable");
    return data.keys ?? [];
  }
}
