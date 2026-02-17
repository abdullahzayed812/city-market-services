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

  constructor(
    private clientId: string,
    private clientSecret: string,
    private authServiceTokenUrl: string,
    private serviceName: string // For logging purposes
  ) {}

  private async fetchToken(): Promise<string> {
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

      this.token = response.data.access_token;

      // Set expiry time a bit before actual expiry for proactive refresh
      this.expiryTime = Date.now() + response.data.expires_in * 1000 - 60 * 1000; // 1 minute before expiry
      this.scheduleRefresh();
      Logger.info(`[${this.serviceName}] Service token fetched successfully.`);
      return this.token;
    } catch (error: any) {
      Logger.error(`[${this.serviceName}] Failed to fetch service token: ${error.message}`);
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
    if (!this.token || Date.now() >= this.expiryTime) {
      return this.fetchToken();
    }
    return this.token;
  }
}
