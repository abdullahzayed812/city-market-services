import axios from "axios";
import { UserRole } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";

export interface AdminDirectory {
  // User ids of every active ADMIN account
  listAdminUserIds(): Promise<string[]>;
}

const CACHE_MS = 60_000;
const PAGE_SIZE = 200;

// Reads ADMIN accounts from auth-service with this service's own token. Cached for a minute so a
// burst of events doesn't hit auth-service once per event; on failure the last good list is reused.
export class AuthAdminDirectory implements AdminDirectory {
  private cached: { ids: string[]; at: number } | null = null;
  private inflight: Promise<string[]> | null = null;

  constructor(
    private authServiceUrl: string,
    private getServiceToken: () => Promise<string>,
  ) {}

  async listAdminUserIds(): Promise<string[]> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return this.cached.ids;
    if (!this.inflight) {
      this.inflight = this.fetchAll()
        .then((ids) => {
          this.cached = { ids, at: Date.now() };
          return ids;
        })
        .catch((error) => {
          Logger.warn(`[AdminDirectory] Failed to list admins: ${error?.message}`);
          // Unknown recipients must fail the event (it is retried), unless we have a previous list
          if (this.cached) return this.cached.ids;
          throw error;
        })
        .finally(() => {
          this.inflight = null;
        });
    }
    return this.inflight;
  }

  private async fetchAll(): Promise<string[]> {
    const token = await this.getServiceToken();
    const ids: string[] = [];
    for (let page = 1; ; page++) {
      const { data } = await axios.get(`${this.authServiceUrl}/users`, {
        params: { role: UserRole.ADMIN, status: "active", page, limit: PAGE_SIZE },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });
      const rows: Array<{ id: string }> = data?.data?.data ?? [];
      ids.push(...rows.map((u) => u.id));
      const total = Number(data?.data?.total ?? ids.length);
      if (rows.length < PAGE_SIZE || ids.length >= total) break;
    }
    return ids;
  }
}
