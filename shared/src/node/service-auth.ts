import axios from "axios";
import { Logger } from "./utils/logger.js"; // Assuming shared Logger utility

export interface ServiceTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class ServiceAuthenticator {
  private token: string | null = null;
  private expiryTime: number = 0;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private fetchingPromise: Promise<string> | null = null;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private authServiceTokenUrl: string,
    private serviceName: string // For logging purposes
  ) { }

  private async fetchToken(retries = 5, backoff = 1000): Promise<string> {
    try {
      Logger.info(`[${this.serviceName}] Fetching new service token...`);
      const response = await axios.post<ServiceTokenResponse>(
        this.authServiceTokenUrl,
        new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      this.token = response.data.access_token.trim();

      // Set expiry time a bit before actual expiry for proactive refresh
      this.expiryTime = Date.now() + response.data.expires_in * 1000 - 60 * 1000; // 1 minute before expiry
      this.scheduleRefresh();
      Logger.info(`[${this.serviceName}] Service token fetched successfully.`);
      return this.token as string;
    } catch (error: any) {
      const isRetryable = error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || (error.response && error.response.status >= 500);

      if (retries > 0 && isRetryable) {
        Logger.warn(`[${this.serviceName}] Failed to fetch service token (retrying in ${backoff}ms, ${retries} attempts left): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.fetchToken(retries - 1, backoff * 2);
      }

      Logger.error(`[${this.serviceName}] Failed to fetch service token after retries: ${error.message}`);
      throw new Error(`Failed to obtain service token for ${this.serviceName}`);
    }
  }
  private scheduleRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    const timeToRefresh = this.expiryTime - Date.now();
    if (timeToRefresh > 0) {
      this.refreshTimeout = setTimeout(() => this.fetchToken(), timeToRefresh);
    }
  }

  public async getServiceToken(): Promise<string> {
    const now = Date.now();

    if (this.token && now < this.expiryTime) {
      Logger.info(`[${this.serviceName}] Using cached service token. Expires in ${Math.round((this.expiryTime - now) / 1000)}s`);
      return this.token;
    }

    if (this.fetchingPromise) {
      Logger.info(`[${this.serviceName}] Token fetch already in progress, waiting for it...`);
      return this.fetchingPromise;
    }

    Logger.info(`[${this.serviceName}] No valid token found or expired. Reason: ${!this.token ? 'No token' : 'Expired'}. Fetching new one...`);
    this.fetchingPromise = this.fetchToken().finally(() => {
      this.fetchingPromise = null;
    });

    return this.fetchingPromise!;
  }
}
