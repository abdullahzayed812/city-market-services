import { Scenario, ScenarioResult } from '../core/Scenario';
import { ApiClient } from '../core/ApiClient';
import { DataPool } from '../utils/DataPool';

export class VendorFlow extends Scenario {
    getName(): string {
        return 'Vendor Order Management';
    }

    async run(apiClient: ApiClient, dataPool: DataPool): Promise<ScenarioResult> {
        const startTime = Date.now();
        let totalRequests = 0;
        let successRequests = 0;
        let failedRequests = 0;
        let details: any = {};

        try {
            const vendorToken = dataPool.getVendorToken(1);
            if (!vendorToken) throw new Error('Vendor token not found');
            apiClient.setToken(vendorToken);

            // 1. Get Pending Orders
            console.log('Fetching vendor orders...');
            totalRequests++;
            const vendorId = DataPool.USERS.VENDOR_1.vendorId;
            const ordersRes: any = await apiClient.get(`/api/v1/orders/vendor/${vendorId}?page=1&limit=5`);
            successRequests++;
            const orders = ordersRes.data;

            if (orders && orders.length > 0) {
                const orderToConfirm = orders[0];
                console.log(`Confirming vendor order: ${orderToConfirm.id}`);

                // 2. Accept Order
                totalRequests++;
                await apiClient.post(`/api/v1/orders/vendor-orders/${orderToConfirm.id}/accept`);
                successRequests++;

                // 3. Update Status to PREPARING
                totalRequests++;
                await apiClient.patch(`/api/v1/orders/vendor-orders/${orderToConfirm.id}/status`, {
                    status: 'PREPARING',
                    notes: 'Test started preparing'
                });
                successRequests++;

                details.confirmedOrderId = orderToConfirm.id;
            } else {
                console.log('No pending orders for vendor.');
            }

        } catch (error) {
            console.error('Vendor action failed:', (error as any).message);
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
