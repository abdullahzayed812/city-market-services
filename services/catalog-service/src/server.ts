import { createApp } from "./app";
import { config } from "./config/env";
import { Logger, rabbitMQBus } from "@city-market/shared/node";

const app = createApp();

app.listen(config.port, async () => {
  // Initialize Messaging
  await rabbitMQBus.connect();

  Logger.info(`Catalog Service running on port ${config.port}`);
});

// Orphaned product-proposal photos (never attached, replaced, or left after a decision)
if (config.submissionImageCleanupIntervalMs > 0) {
  const cleanup = () =>
    app.productSubmissionService
      .cleanupOrphanImages(config.submissionImageCleanupGraceSeconds)
      .catch((error) => Logger.warn("Product-proposal photo cleanup failed", { error: error?.message }));
  setTimeout(cleanup, 60_000).unref();
  setInterval(cleanup, config.submissionImageCleanupIntervalMs).unref();
}
