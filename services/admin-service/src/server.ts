import { createApp } from "./app";
import { adminServiceAuthenticator, config } from "./config/env";
import { Logger, rabbitMQBus } from "@city-market/shared/node";

const app = createApp();

// Only used to tell admins' screens that data changed; connect() retries in the background
rabbitMQBus.connect();

app.listen(config.port, async () => {
  try {
    await adminServiceAuthenticator.getServiceToken();
    Logger.info("AdminService authenticator initialized successfully.");

    Logger.info(`Admin Service running on port ${config.port}`);
  } catch (error) {
    Logger.error("Failed to start Admin Service:", error);
    process.exit(1);
  }
});
