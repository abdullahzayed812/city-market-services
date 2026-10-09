import * as path from "path";
import { AxiosInstance } from "axios";
import { env } from "./env";
import { authHeader, registerAccount, loginAccount, withRetry, sleep } from "./http";
import { readCsv } from "./csv";

const DATA_DIR = path.resolve(__dirname, "../../data/generated");

/**
 * Places one real order against a seeded vendor product, has the owning vendor
 * accept + confirm it (fires ORDER_READY), and waits for delivery-service to create
 * the Delivery. Returns its id. Shared by the office and freelance race tests.
 */
export async function createClaimableDelivery(client: AxiosInstance): Promise<string> {
  const products = readCsv(path.join(DATA_DIR, "vendor-products-with-owner.csv"));
  if (!products.length) {
    console.error("No data/generated/vendor-products-with-owner.csv found - run `npm run loadtest:seed` first.");
    throw new Error("no seeded vendor products");
  }
  const product = products[Math.floor(Math.random() * products.length)];

  console.log("Registering a customer and placing an order...");
  const customer = await registerAccount(client, "CUSTOMER", "race-setup");
  const item: Record<string, any> =
    product.measurementType === "WEIGHT" ? { vendorProductId: product.vendorProductId, weightGrams: 500 } : { vendorProductId: product.vendorProductId, quantity: 1 };

  const orderRes = await withRetry(
    () =>
      client.post(
        "/orders",
        { items: [item], deliveryAddress: "Race setup order, Borg El Arab", deliveryLatitude: 30.87, deliveryLongitude: 29.53 },
        authHeader(customer.accessToken),
      ),
    "POST /orders",
  );
  const orderId = orderRes.data.data.order.id;
  const vendorOrderId = orderRes.data.data.vendorOrders[0].id;
  console.log(`  orderId=${orderId} vendorOrderId=${vendorOrderId}`);

  console.log(`Logging in as the owning vendor (${product.vendorEmail}) to accept + confirm...`);
  const vendor = await loginAccount(client, product.vendorEmail, product.vendorPassword);
  await withRetry(() => client.post(`/orders/vendor-orders/${vendorOrderId}/accept`, {}, authHeader(vendor.accessToken)), "accept vendor order");
  await withRetry(
    () => client.patch(`/orders/vendor-orders/${vendorOrderId}/status`, { status: "CONFIRMED" }, authHeader(vendor.accessToken)),
    "confirm vendor order",
  );

  // GET /delivery/deliveries/pending is ADMIN/DELIVERY_MANAGER-only - need a
  // delivery-manager account to poll it, not the vendor we just used above.
  console.log("Polling GET /delivery/deliveries/pending until the delivery appears (waiting on the ORDER_READY -> Delivery RabbitMQ hop)...");
  const manager = await loginAccount(client, env.deliveryManagerEmails[0], env.seedAccountsPassword);
  let deliveryId: string | null = null;
  for (let attempt = 0; attempt < 15 && !deliveryId; attempt++) {
    await sleep(1000);
    const pendingRes = await withRetry(() => client.get("/delivery/deliveries/pending", authHeader(manager.accessToken)), "GET /delivery/deliveries/pending");
    const match = (pendingRes.data.data || []).find((d: any) => d.customerOrderId === orderId);
    if (match) deliveryId = match.id;
  }

  if (!deliveryId) {
    throw new Error("Delivery never appeared in the pending list within 15s - is delivery-service's OrderReadyConsumer running and consuming RabbitMQ?");
  }

  return deliveryId;
}
