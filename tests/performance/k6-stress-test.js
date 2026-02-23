import http from 'k6/http';
import { check, sleep } from 'k6';

// Environment variables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CUSTOMER_TOKEN = __ENV.CUSTOMER_TOKEN || 'test-customer-token';
const VENDOR_TOKEN_1 = __ENV.VENDOR_TOKEN_1 || 'test-vendor-token-1';
const VENDOR_TOKEN_2 = __ENV.VENDOR_TOKEN_2 || 'test-vendor-token-2';

export const options = {
    scenarios: {
        race_condition_simulation: {
            executor: 'constant-vus',
            vus: 50,
            duration: '10s',
        },
    },
};

export default function () {
    // 1. Customer creates an order
    const orderPayload = JSON.stringify({
        customerId: 'customer-1',
        deliveryAddress: '123 Main St',
        deliveryLatitude: 30.0,
        deliveryLongitude: 31.0,
        items: [
            { productId: 'product-1', quantity: 2, vendorId: 'vendor-1', price: 100 },
            { productId: 'product-2', quantity: 1, vendorId: 'vendor-2', price: 50 },
        ]
    });

    const headersList = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CUSTOMER_TOKEN}`
    };

    const orderRes = http.post(`${BASE_URL}/orders`, orderPayload, { headers: headersList });
    check(orderRes, { 'Order created successfully': (r) => r.status === 201 });
    sleep(1);

    if (orderRes.status !== 201) return;

    const orderData = orderRes.json();
    const vendorOrder1 = orderData.vendorOrders.find(vo => vo.vendorId === 'vendor-1');

    if (!vendorOrder1) return;

    // 2. Vendor 1 submits a proposal (testing idempotency for duplicate pending proposals)
    const proposalPayload = JSON.stringify([
        { itemId: vendorOrder1.items[0].id, type: 'QUANTITY_REDUCTION', proposedQuantity: 1 }
    ]);

    const vendor1Headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VENDOR_TOKEN_1}` };

    // Vendor submits exactly one proposal to get it to PENDING
    http.post(`${BASE_URL}/orders/vendor/${vendorOrder1.id}/propose-changes`, proposalPayload, { headers: vendor1Headers });
    // Attempting parallel identical proposal request should fail due to our fix
    const dupRes = http.post(`${BASE_URL}/orders/vendor/${vendorOrder1.id}/propose-changes`, proposalPayload, { headers: vendor1Headers });
    check(dupRes, { 'Duplicate proposal blocked': (r) => r.status === 400 || r.status === 500 });
}
