import { createApp } from "./app";
import { config, orderServiceAuthenticator } from "./config/env";
import { Logger, rabbitMQBus } from "@city-market/shared/node";

const app = createApp();

app.listen(config.port, async () => {
  try {
    await rabbitMQBus.connect();

    // Initialize the authenticator
    await orderServiceAuthenticator.getServiceToken();
    Logger.info("OrderService authenticator initialized successfully.");

    Logger.info(`Order Service running on port ${config.port}`);
  } catch (error) {
    Logger.error("Failed to start Order Service:", error);
    process.exit(1);
  }
});
