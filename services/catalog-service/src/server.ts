import { createApp } from "./app";
import { config } from "./config/env";
import { Logger, rabbitMQBus } from "@city-market/shared/node";

const app = createApp();

app.listen(config.port, async () => {
  // Initialize Messaging
  await rabbitMQBus.connect();

  Logger.info(`Catalog Service running on port ${config.port}`);
});
