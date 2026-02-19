import { createApp } from "./app";
import { config, deliveryServiceAuthenticator } from "./config/env";
import { Logger, rabbitMQBus } from "@city-market/shared/node";

const app = createApp();

app.listen(config.port, async () => {
  try {
    await rabbitMQBus.connect();
    Logger.info(`Delivery Service running on port ${config.port}`);

    // Initialize the authenticator (e.g., fetch token on startup)
    deliveryServiceAuthenticator.getServiceToken();
    Logger.info("DeliveryService authenticator initialized successfully.");
  } catch (error) {
    Logger.error("Failed to initialize DeliveryService authenticator:", error);
    process.exit(1); // Exit if authentication fails on startup
  }
});
