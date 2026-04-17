import { Scenario, ScenarioResult } from '../core/Scenario';
import { ApiClient } from '../core/ApiClient';
import { DataPool } from '../utils/DataPool';

export class FullLifecycle extends Scenario {
    getName(): string {
        return 'Complete Order Lifecycle Simulation';
    }

    async run(apiClient: ApiClient, dataPool: DataPool): Promise<ScenarioResult> {
        const startTime = Date.now();
        let totalRequests = 0;
        let successRequests = 0;
        let failedRequests = 0;
        let details: any = {};

        try {
            // 1. Customer places order
            const customerToken = dataPool.getCustomerToken();
            apiClient.setToken(customerToken!);

            console.log('[FullLifecycle] Browsing products...');
            const products = dataPool.getProducts();
            if (products.length === 0) throw new Error('No dynamic products available');

            console.log('[FullLifecycle] Placing order...');
            const orderRes: any = await apiClient.post('/api/v1/orders', {
                customerId: DataPool.USERS.CUSTOMER.id,
                deliveryAddress: 'Full Lifecycle Address',
                deliveryLatitude: 30.1,
                deliveryLongitude: 31.1,
                items: [{
                    vendorProductId: products[0].id,
                    quantity: products[0].measurement_type === 'UNIT' ? 1 : undefined,
                    weightGrams: products[0].measurement_type === 'WEIGHT' ? 500 : undefined,
                }]
            });
            totalRequests++; successRequests++;
            const orderId = orderRes.data.order.id;
            const vendorOrderId = orderRes.data.vendorOrders[0].id;
            details.orderId = orderId;

            // 2. Vendor confirms order
            const vendorToken = dataPool.getVendorToken(1);
            apiClient.setToken(vendorToken!);

            console.log(`[FullLifecycle] Vendor confirming order ${vendorOrderId}...`);
            await apiClient.post(`/api/v1/orders/vendor-orders/${vendorOrderId}/accept`);
            totalRequests++; successRequests++;

            await apiClient.patch(`/api/v1/orders/vendor-orders/${vendorOrderId}/status`, {
                status: 'READY_FOR_PICKUP'
            });
            totalRequests++; successRequests++;

            // Wait a bit for async delivery creation (if event-driven)
            console.log('[FullLifecycle] Waiting for delivery assignment...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 3. Courier delivers
            const courierToken = dataPool.getToken(DataPool.USERS.COURIER.email);
            apiClient.setToken(courierToken!);

            // Get courier ID
            const courierRes: any = await apiClient.get('/api/v1/delivery/couriers/me');
            const courierId = courierRes.data.id;
            totalRequests++; successRequests++;

            // Find delivery
            const deliveriesRes: any = await apiClient.get('/api/v1/delivery/deliveries/pending');
            totalRequests++; successRequests++;

            const delivery = deliveriesRes.data.find((d: any) => d.customerOrderId === orderId);
            if (delivery) {
                console.log(`[FullLifecycle] Assigning delivery ${delivery.id} to courier ${courierId}...`);
                await apiClient.post(`/api/v1/delivery/deliveries/${delivery.id}/assign`, { courierId });
                totalRequests++; successRequests++;

                console.log(`[FullLifecycle] Updating delivery ${delivery.id} status...`);
                await apiClient.patch(`/api/v1/delivery/deliveries/${delivery.id}/status`, { status: 'PICKED_UP' });
                totalRequests++; successRequests++;

                await apiClient.patch(`/api/v1/delivery/deliveries/${delivery.id}/status`, { status: 'ON_THE_WAY' });
                totalRequests++; successRequests++;

                await apiClient.patch(`/api/v1/delivery/deliveries/${delivery.id}/status`, { status: 'DELIVERED' });
                totalRequests++; successRequests++;
                details.deliveryId = delivery.id;
            } else {
                console.warn('[FullLifecycle] No delivery found for the order. Check if delivery-service is consuming events.');
                failedRequests++;
            }

        } catch (error) {
            console.error('[FullLifecycle] Failed:', (error as any).message);
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
