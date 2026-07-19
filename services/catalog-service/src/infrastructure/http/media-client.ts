import { catalogServiceAuthenticator, config } from "../../config/env";

export interface MediaUploadResult {
  url: string;
  sizes: { small: string; medium: string; large: string };
}

export class MediaClient {
  async uploadImageFromUrl(imageUrl: string, folder: string, entityId: string): Promise<MediaUploadResult> {
    const serviceToken = await catalogServiceAuthenticator.getServiceToken();

    const response = await fetch(`${config.mediaServiceUrl}/media/upload-from-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({ imageUrl, folder, entityId }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`media_upload_failed_${response.status}: ${body}`);
    }

    const json = (await response.json()) as { data: MediaUploadResult };
    return json.data;
  }
}
