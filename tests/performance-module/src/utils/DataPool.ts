import { ApiClient } from '../core/ApiClient';
import { DbClient } from '../core/DbClient';
import { SEED_DATA } from '@city-market/shared';

export class DataPool {
  public static USERS = {
    CUSTOMER: {
      email: 'customer@citymarket.com',
      id: SEED_DATA.USERS.CUSTOMER,
    },
    VENDOR_1: {
      email: 'supermarket1@citymarket.com',
      id: SEED_DATA.USERS.MADINATY_SUPERMARKET,
      vendorId: SEED_DATA.VENDORS.SUPER_MARKET_1
    },
    VENDOR_2: {
      email: 'supermarket2@citymarket.com',
      id: SEED_DATA.USERS.AL_JAZIRA_SUPERMARKET,
      vendorId: SEED_DATA.VENDORS.SUPER_MARKET_2
    },
    COURIER: {
      email: 'courier@citymarket.com',
      id: SEED_DATA.USERS.COURIER,
    }
  };

  private tokens: Map<string, string> = new Map();
  private products: any[] = [];
  private dbClient: DbClient;

  constructor(private apiBaseUrl: string) {
    this.dbClient = new DbClient();
  }

  async authenticateAll() {
    const authClient = new ApiClient(this.apiBaseUrl);

    for (const [key, user] of Object.entries(DataPool.USERS)) {
      try {
        const response = await authClient.post<{ data: { accessToken: string } }>('/api/v1/auth/login', {
          email: user.email,
          password: 'password123'
        });
        this.tokens.set(user.email, (response as any).data.accessToken);
        console.log(`Authenticated ${key}`);
      } catch (error) {
        console.error(`Failed to authenticate ${key}:`, (error as any).message);
      }
    }
  }

  getToken(email: string): string | undefined {
    return this.tokens.get(email);
  }

  getVendorToken(index: 1 | 2): string | undefined {
    return this.tokens.get(index === 1 ? DataPool.USERS.VENDOR_1.email : DataPool.USERS.VENDOR_2.email);
  }

  getCustomerToken(): string | undefined {
    return this.tokens.get(DataPool.USERS.CUSTOMER.email);
  }

  async fetchDynamicData() {
    console.log('📦 Fetching dynamic product data from DB...');
    this.products = await this.dbClient.getRandomProducts(50);
    console.log(`✅ Loaded ${this.products.length} products.`);
  }

  getProducts(): any[] {
    return this.products;
  }

  getVendorProducts(vendorId: string): any[] {
    return this.products.filter(p => p.vendor_id === vendorId);
  }

  async cleanup() {
    await this.dbClient.close();
  }
}
