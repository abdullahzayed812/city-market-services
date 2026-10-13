import { AsyncLocalStorage } from "async_hooks";
import { PoolConnection } from "mysql2/promise";
import { Database, Logger } from "@city-market/shared/node";

// Events published inside a transaction must not reach consumers before it commits:
// consumers (catalog, delivery, websocket-gateway) read the order back and either
// got order_not_found or acted on a state that was then rolled back. Deadlock
// retries also re-ran the callback, publishing the same event once per attempt.
//
// withTransactionAndEvents() gives each attempt a buffer; OrderPublisher queues into
// it instead of publishing, and the buffer of the attempt that commits is flushed.
// Rolled-back attempts are dropped. The managers called inside a transaction don't
// need to know - they keep calling the publisher as before.
//
// Not an outbox: a publish that fails after commit is logged, not retried.

type Buffer = { state: "open" | "flushed" | "discarded"; events: Array<() => Promise<void>> };

const storage = new AsyncLocalStorage<Buffer>();

/**
 * Queues `publish` if called inside withTransactionAndEvents() and returns true.
 * Returns false when there is no open transaction buffer (the caller publishes now).
 */
export function deferUntilCommit(publish: () => Promise<void>): boolean {
  const buffer = storage.getStore();
  if (!buffer || buffer.state === "flushed") return false;
  // Fire-and-forget work started by an attempt that rolled back publishes nothing
  if (buffer.state === "discarded") return true;
  buffer.events.push(publish);
  return true;
}

export async function withTransactionAndEvents<T>(db: Database, fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  let committed: Buffer | undefined;
  const result = await db.withTransaction(async (connection) => {
    const buffer: Buffer = { state: "open", events: [] };
    committed = buffer;
    try {
      return await storage.run(buffer, () => fn(connection));
    } catch (error) {
      buffer.state = "discarded";
      throw error;
    }
  });

  const buffer = committed!;
  buffer.state = "flushed";
  for (const publish of buffer.events) {
    try {
      await publish();
    } catch (error: any) {
      // The transaction is already committed - failing the request now would make
      // callers retry an operation that succeeded.
      Logger.error(`[OrderService] Failed to publish event after commit: ${error.message}`);
    }
  }
  return result;
}
