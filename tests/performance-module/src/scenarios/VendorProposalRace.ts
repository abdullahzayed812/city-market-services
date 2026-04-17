import { Scenario, ScenarioResult } from '../core/Scenario';
import { ApiClient } from '../core/ApiClient';
import { DataPool } from '../utils/DataPool';
import { SEED_DATA } from '@city-market/shared';

export class VendorProposalRace extends Scenario {
  getName(): string {
    return 'Vendor Proposal Race Condition';
  }

  async run(apiClient: ApiClient, dataPool: DataPool): Promise<ScenarioResult> {
    const startTime = Date.now();
    let totalRequests = 0;
    let successRequests = 0;
    let failedRequests = 0;

    const customerToken = dataPool.getCustomerToken();
    if (!customerToken) throw new Error('Customer token not found');

    // 1. Create an order with items from both vendors
    apiClient.setToken(customerToken);

    const v1Products = dataPool.getVendorProducts(DataPool.USERS.VENDOR_1.vendorId);
    const v2Products = dataPool.getVendorProducts(DataPool.USERS.VENDOR_2.vendorId);

    if (v1Products.length === 0 || v2Products.length === 0) {
      throw new Error('Insufficient dynamic products found for both vendors');
    }

    console.log('Creating initial order for race condition test...');
    const orderRes: any = await apiClient.post('/api/v1/orders', {
      customerId: DataPool.USERS.CUSTOMER.id,
      deliveryAddress: 'Test Address',
      deliveryLatitude: 30.0,
      deliveryLongitude: 31.0,
      items: [
        {
          vendorProductId: v1Products[0].id,
          quantity: v1Products[0].measurement_type === 'UNIT' ? 10 : undefined,
          weightGrams: v1Products[0].measurement_type === 'WEIGHT' ? 1000 : undefined
        },
        {
          vendorProductId: v2Products[0].id,
          quantity: v2Products[0].measurement_type === 'UNIT' ? 10 : undefined,
          weightGrams: v2Products[0].measurement_type === 'WEIGHT' ? 1000 : undefined
        },
      ],
    });

    const vendorOrders = orderRes.data.vendorOrders;
    const vendor1OrderId = vendorOrders.find((vo: any) => vo.vendorId === DataPool.USERS.VENDOR_1.vendorId).id;

    // 2. Simulate concurrent proposals from Vendor 1
    const vendor1Token = dataPool.getVendorToken(1);
    if (!vendor1Token) throw new Error('Vendor 1 token not found');

    apiClient.setToken(vendor1Token);

    const proposalPayload = [
      { itemId: vendorOrders[0].items[0].id, type: 'QUANTITY_REDUCTION', proposedQuantity: 5 }
    ];

    console.log(`Firing concurrent proposals for Vendor Order ${vendor1OrderId}...`);

    const requests = Array.from({ length: 10 }).map(() => {
      totalRequests++;
      return apiClient.post(`/api/v1/orders/vendor-orders/${vendor1OrderId}/propose`, { proposals: proposalPayload })
        .then(() => { successRequests++; })
        .catch(() => { failedRequests++; });
    });

    await Promise.all(requests);

    return this.createResult(
      successRequests === 1, // We expect only one to succeed if idempotency/locking is working
      startTime,
      totalRequests,
      successRequests,
      failedRequests,
      { vendor1OrderId }
    );
  }
}
