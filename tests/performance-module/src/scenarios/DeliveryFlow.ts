import { Scenario, ScenarioResult } from '../core/Scenario';
import { ApiClient } from '../core/ApiClient';
import { DataPool } from '../utils/DataPool';

export class DeliveryFlow extends Scenario {
    getName(): string {
        return 'Delivery Personnel Flow';
    }

    async run(apiClient: ApiClient, dataPool: DataPool): Promise<ScenarioResult> {
        const startTime = Date.now();
        let totalRequests = 0;
        let successRequests = 0;
        let failedRequests = 0;
        let details: any = {};

        try {
            const courierToken = dataPool.getToken(DataPool.USERS.COURIER.email);
            if (!courierToken) throw new Error('Courier token not found');
            apiClient.setToken(courierToken);

            // 1. Fetch assigned deliveries
            console.log('Fetching courier deliveries...');
            totalRequests++;
            const deliveriesRes: any = await apiClient.get('/api/v1/delivery/deliveries/my-deliveries');
            successRequests++;

            const deliveries = deliveriesRes.data;
            if (deliveries && deliveries.length > 0) {
                const delivery = deliveries[0];
                console.log(`Updating delivery status for: ${delivery.id}`);

                // 2. Update to PICKED_UP
                totalRequests++;
                await apiClient.patch(`/api/v1/delivery/deliveries/${delivery.id}/status`, { status: 'PICKED_UP' });
                successRequests++;

                // 3. Update to DELIVERED
                totalRequests++;
                await apiClient.patch(`/api/v1/delivery/deliveries/${delivery.id}/status`, { status: 'DELIVERED' });
                successRequests++;

                details.deliveryId = delivery.id;
            } else {
                console.log('No active deliveries for courier.');
            }

        } catch (error) {
            console.error('Delivery action failed:', (error as any).message);
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
