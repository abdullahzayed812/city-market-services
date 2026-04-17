import { Scenario, ScenarioResult } from '../core/Scenario';
import { ApiClient } from '../core/ApiClient';
import { DataPool } from '../utils/DataPool';

export class CustomerFlow extends Scenario {
    getName(): string {
        return 'Customer Full Journey';
    }

    async run(apiClient: ApiClient, dataPool: DataPool): Promise<ScenarioResult> {
        const startTime = Date.now();
        let totalRequests = 0;
        let successRequests = 0;
        let failedRequests = 0;
        let details: any = {};

        try {
            const customerToken = dataPool.getCustomerToken();
            if (!customerToken) throw new Error('Customer token not found');
            apiClient.setToken(customerToken);

            // 1. Browse Products
            console.log('Browsing products...');
            const products = dataPool.getProducts();
            if (!products || products.length === 0) throw new Error('No dynamic products found to order');

            // 2. Create Order
            console.log('Creating order...');
            const items = products.slice(0, 2).map((p: any) => ({
                vendorProductId: p.id,
                quantity: p.measurement_type === 'UNIT' ? 1 : undefined,
                weightGrams: p.measurement_type === 'WEIGHT' ? 500 : undefined,
            }));

            totalRequests++;
            const orderRes: any = await apiClient.post('/api/v1/orders', {
                customerId: DataPool.USERS.CUSTOMER.id,
                deliveryAddress: 'Test Address',
                deliveryLatitude: 30.0,
                deliveryLongitude: 31.0,
                items
            });
            successRequests++;
            details.orderId = orderRes.data.order.id;
            console.log(`Order created: ${details.orderId}`);

        } catch (error) {
            console.error('Customer action failed:', (error as any).message);
            failedRequests++;
        }

        return this.createResult(
            failedRequests === 0,
            startTime,
            totalRequests,
            successRequests,
            failedRequests,
            details
        );
    }
}
