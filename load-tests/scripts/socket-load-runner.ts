/**
 * Dedicated Socket.IO load runner (Phase 19). Artillery's socket.io engine assumes
 * a request/response-shaped, client-driven protocol; this gateway is the opposite -
 * a pure RabbitMQ -> Socket.IO broadcast bridge with NO client-to-server events at
 * all (verified: services/websocket-gateway/src/socket.ts registers no `socket.on`
 * handlers besides the built-in `disconnect`). Modelling "connect, join a room by
 * role, wait for a server-initiated broadcast" through Artillery's engine would
 * mean fighting the tool's assumptions; a small direct socket.io-client script
 * matches the real shape of this service far better, per the task's own guidance
 * to fall back to one rather than falsify results with an ill-fitting plugin.
 *
 * Ground truth (services/websocket-gateway/src/socket.ts):
 *   - default namespace "/", auth via `socket.handshake.auth.token` (a raw JWT,
 *     no "Bearer " prefix - matches web/customer/src/hooks/useSocket.ts:202).
 *   - on connect, the server joins every socket to `user:{userId}` and
 *     `role:{role}`, plus `vendor:{vendorProfileId}` for VENDOR or
 *     `courier:{courierProfileId}` for COURIER (fetched server-side from
 *     vendor-service/delivery-service using the same bearer token). NOTE:
 *     docker-compose.yml's websocket-gateway service was missing the
 *     VENDOR_SERVICE_URL/DELIVERY_SERVICE_URL env vars this lookup needs - fixed
 *     directly in docker-compose.yml (found by this exact validation: the vendor
 *     room-join was failing silently, so VENDOR/COURIER never received anything
 *     routed to their entity room even though the event itself published fine).
 *   - every RabbitMQ EventType is re-emitted verbatim as a Socket.IO event of the
 *     same name to the relevant room(s) - there is no fixed "event catalog" beyond
 *     the full EventType enum (shared/src/events/event-types.ts).
 *
 * Two modes:
 *   npm run loadtest:socket -- --connections 200 --role CUSTOMER --duration 60
 *     Opens N concurrent connections, holds them for --duration seconds, and
 *     reports connection attempts/successes/failures/disconnects/reconnects.
 *
 *   npm run loadtest:socket -- --mode latency --connections 20
 *     For each of N VENDOR connections (one per seeded vendor - see
 *     runLatencyMode's own comment for why VENDOR/VENDOR_ORDER_CREATED and not
 *     CUSTOMER/ORDER_CREATED): connects, has a fresh customer place one real order
 *     for that vendor's product via POST /orders (data/generated/
 *     vendor-products-with-owner.csv - run `npm run loadtest:seed` first), and
 *     measures the time between the HTTP response and the event arriving on the
 *     vendor's socket - a real, correlatable end-to-end event-delivery latency,
 *     not a synthetic one.
 */
// Untyped require rather than `import { io, Socket } from "socket.io-client"`:
// the installed version's package.json points classic Node module resolution at
// mismatched ESM/CJS type-declaration files (its .d.ts re-exports use `.js`-suffixed
// relative specifiers), which trips up this project's tsconfig. Not worth widening
// moduleResolution for the whole package over one script's import - `any` here costs
// nothing at runtime since ts-node runs in transpile-only mode anyway.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { io } = require("socket.io-client");
type Socket = any;
import * as path from "path";
import { env } from "./lib/env";
import { assertSafeToRun } from "./lib/safety";
import { createApiClient, authHeader, registerAccount, loginAccount, withRetry, sleep } from "./lib/http";
import { readCsv } from "./lib/csv";

const DATA_DIR = path.resolve(__dirname, "../data/generated");

function parseFlags(args: string[]) {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      flags[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
    }
  }
  return flags;
}

function wsUrlFromApiBase(apiBaseUrl: string): string {
  // websocket-gateway listens on PORT 3011 (docker-compose.yml), but is NOT
  // published to the host at all in docker-compose - confirmed directly (no
  // `ports:` block on that service). It's only reachable there through nginx's
  // `/socket.io/` location block (nginx/nginx.conf) proxying to it internally on
  // the SAME host:port nginx itself listens on - socket.io-client's default
  // request path is already "/socket.io/", so pointing at nginx's own origin
  // with no port override works with zero extra config.
  //
  // Running api-gateway/websocket-gateway directly via `npm run dev` (no nginx,
  // no docker) is the one case where the gateway's REST port (3000) and the
  // websocket-gateway's own port (3011) genuinely differ - detected here by
  // BASE_URL using a non-standard, non-80/443 port.
  if (process.env.WS_URL) return process.env.WS_URL;
  const url = new URL(apiBaseUrl);
  const looksLikeDirectDevPorts = url.port && url.port !== "80" && url.port !== "443";
  return looksLikeDirectDevPorts ? `${url.protocol}//${url.hostname}:3011` : `${url.protocol}//${url.host}`;
}

interface ConnectionStats {
  attempted: number;
  connected: number;
  failed: number;
  disconnected: number;
  reconnected: number;
  connectTimesMs: number[];
}

async function runConnectionLoad(connections: number, role: string, durationSeconds: number) {
  const client = createApiClient();
  const wsUrl = wsUrlFromApiBase(env.baseUrl);
  console.log(`Opening ${connections} ${role} connections to ${wsUrl}, holding for ${durationSeconds}s...`);

  const stats: ConnectionStats = { attempted: 0, connected: 0, failed: 0, disconnected: 0, reconnected: 0, connectTimesMs: [] };
  const sockets: Socket[] = [];

  await Promise.all(
    Array.from({ length: connections }, async (_, i) => {
      stats.attempted++;
      let account;
      try {
        account = await registerAccount(client, role as "CUSTOMER" | "VENDOR" | "COURIER", `ws-${role.toLowerCase()}`);
      } catch (err: any) {
        stats.failed++;
        console.warn(`  [${i}] registration failed: ${err.message}`);
        return;
      }

      const startedAt = Date.now();
      const socket = io(wsUrl, {
        auth: { token: account.accessToken },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 3,
        timeout: 10000,
      });
      sockets.push(socket);

      socket.on("connect", () => {
        stats.connected++;
        stats.connectTimesMs.push(Date.now() - startedAt);
      });
      socket.on("connect_error", (err: Error) => {
        stats.failed++;
        console.warn(`  [${i}] connect_error: ${err.message}`);
      });
      socket.on("disconnect", () => {
        stats.disconnected++;
      });
      socket.on("reconnect", () => {
        stats.reconnected++;
      });

      // Small random stagger so we don't open every connection in the same tick
      // (a real user population would not all open sockets simultaneously either).
      await sleep(Math.random() * 200);
    }),
  );

  await sleep(durationSeconds * 1000);

  for (const s of sockets) s.close();
  await sleep(500);

  const sorted = [...stats.connectTimesMs].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;

  console.log("\n--- Socket.IO connection load results ---");
  console.log(`  attempted:    ${stats.attempted}`);
  console.log(`  connected:    ${stats.connected}`);
  console.log(`  failed:       ${stats.failed}`);
  console.log(`  disconnected: ${stats.disconnected} (during hold period, includes clean closes at teardown)`);
  console.log(`  reconnected:  ${stats.reconnected}`);
  console.log(`  connect time: p50=${sorted[Math.floor(sorted.length * 0.5)] || 0}ms p95=${p95}ms max=${sorted[sorted.length - 1] || 0}ms`);
}

/**
 * Measures HTTP-response -> socket-event latency for a real, order-placement-
 * triggered event. Originally probed EventType.ORDER_CREATED (what the CUSTOMER
 * receives per web/customer/src/hooks/useSocket.ts's listener list) - discovered
 * while validating this suite against a live stack that this never fires:
 * OrderPublisher.publishOrderCreated() exists and notification-service subscribes
 * to it, but grepping the entire order-service source finds ZERO callers of that
 * method anywhere. It's dead code in the product itself, not a bug in this tool -
 * flagged in this suite's implementation report, not something to route around
 * silently. VENDOR_ORDER_CREATED IS actually published, synchronously, during
 * order creation (order-creation.manager.ts) with a real vendorId in its payload,
 * so this probes that instead - as the VENDOR whose product got ordered, since
 * websocket-gateway routes it to the `vendor:{vendorId}` room, not the customer's.
 *
 * --connections concurrent vendor logins each pick a random row from
 * vendor-products-with-owner.csv - keep --connections at or below the number of
 * DISTINCT seeded vendors, or two connections logging in as the same vendor at
 * once will kick each other's session (single-active-session-per-user, see
 * processors/auth.ts); seed more vendors (`loadtest:seed -- --vendors N`) for a
 * wider run.
 */
async function runLatencyMode(connections: number) {
  const products = readCsv(path.join(DATA_DIR, "vendor-products-with-owner.csv"));
  if (!products.length) {
    console.error("No data/generated/vendor-products-with-owner.csv found - run `npm run loadtest:seed` first.");
    process.exit(1);
  }

  const client = createApiClient();
  const wsUrl = wsUrlFromApiBase(env.baseUrl);
  console.log(`Measuring VENDOR_ORDER_CREATED event latency for ${connections} vendor connections against ${wsUrl}...`);

  const latencies: number[] = [];
  let failures = 0;

  await Promise.all(
    Array.from({ length: connections }, async (_, i) => {
      const product = products[Math.floor(Math.random() * products.length)];
      const vendor = await loginAccount(client, product.vendorEmail, product.vendorPassword);
      const socket = io(wsUrl, { auth: { token: vendor.accessToken }, transports: ["websocket", "polling"], timeout: 10000 });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("socket connect timeout")), 10000);
        socket.on("connect", () => {
          clearTimeout(timeout);
          resolve();
        });
        socket.on("connect_error", (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      }).catch((err) => {
        failures++;
        console.warn(`  [${i}] socket connect failed: ${err.message}`);
      });

      if (!socket.connected) {
        socket.close();
        return;
      }

      const eventArrival = new Promise<number>((resolve) => {
        socket.once("VENDOR_ORDER_CREATED", () => resolve(Date.now()));
        setTimeout(() => resolve(-1), 15000); // give up waiting for the event after 15s
      });

      const customer = await registerAccount(client, "CUSTOMER", "ws-latency");
      const item: Record<string, any> = { vendorProductId: product.vendorProductId };
      if (product.measurementType === "WEIGHT") item.weightGrams = 500;
      else item.quantity = 1;

      const requestSentAt = Date.now();
      try {
        await withRetry(
          () =>
            client.post(
              "/orders",
              { items: [item], deliveryAddress: "Load test WS latency probe, Borg El Arab", deliveryLatitude: 30.87, deliveryLongitude: 29.53 },
              authHeader(customer.accessToken),
            ),
          "POST /orders",
        );
      } catch (err: any) {
        failures++;
        console.warn(`  [${i}] order creation failed: ${err.message}`);
        socket.close();
        return;
      }

      const arrivedAt = await eventArrival;
      socket.close();
      if (arrivedAt === -1) {
        failures++;
        console.warn(`  [${i}] VENDOR_ORDER_CREATED never arrived within 15s`);
      } else {
        latencies.push(arrivedAt - requestSentAt);
      }
    }),
  );

  const sorted = [...latencies].sort((a, b) => a - b);
  console.log("\n--- VENDOR_ORDER_CREATED event delivery latency (HTTP response -> socket event) ---");
  console.log(`  samples: ${sorted.length}, failures/timeouts: ${failures}`);
  if (sorted.length) {
    console.log(`  p50=${sorted[Math.floor(sorted.length * 0.5)]}ms p95=${sorted[Math.floor(sorted.length * 0.95)]}ms max=${sorted[sorted.length - 1]}ms`);
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  assertSafeToRun(env.baseUrl, "socket-load-runner");

  const connections = parseInt(flags.connections || "50", 10);
  const mode = flags.mode || "connections";

  if (mode === "latency") {
    await runLatencyMode(connections);
  } else {
    const role = (flags.role || "CUSTOMER").toUpperCase();
    const duration = parseInt(flags.duration || "60", 10);
    await runConnectionLoad(connections, role, duration);
  }
}

main().catch((err) => {
  console.error("\nsocket-load-runner failed:", err.message);
  process.exit(1);
});
