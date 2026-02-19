import { createApp } from "./app";
import { adminServiceAuthenticator, config } from "./config/env";
import { Logger } from "@city-market/shared/node";

const app = createApp();

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
